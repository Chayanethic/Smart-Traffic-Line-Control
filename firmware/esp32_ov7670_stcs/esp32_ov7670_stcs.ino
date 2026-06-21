#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"
#include "img_converters.h"
#include <Adafruit_MCP23X17.h>

// Set these values before flashing.
const char* WIFI_SSID = "YOUR_2_4_GHZ_WIFI";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_BASE_URL = "https://your-stcs-api.onrender.com";
const char* DEVICE_ID = "YOUR_REGISTERED_DEVICE_ID";
const char* API_KEY = "YOUR_DEVICE_API_KEY";
const char* CAMERA_LANE = "lane1";

// Example pin map only. OV7670 carrier boards differ. Match these to your
// board schematic and avoid pins used by your traffic-light driver.
#define CAM_PIN_PWDN  -1
#define CAM_PIN_RESET -1
#define CAM_PIN_XCLK  21
#define CAM_PIN_SIOD  26
#define CAM_PIN_SIOC  27
#define CAM_PIN_D7    35
#define CAM_PIN_D6    34
#define CAM_PIN_D5    39
#define CAM_PIN_D4    36
#define CAM_PIN_D3    19
#define CAM_PIN_D2    18
#define CAM_PIN_D1     5
#define CAM_PIN_D0     4
#define CAM_PIN_VSYNC 25
#define CAM_PIN_HREF  23
#define CAM_PIN_PCLK  22

// A camera consumes most ESP32 GPIOs. Use an MCP23017 I/O expander on the
// same SCCB/I2C bus to drive 12 opto-isolated lamp channels.
Adafruit_MCP23X17 lampExpander;
const uint8_t RED_PINS[4] = {0, 3, 6, 9};
const uint8_t YELLOW_PINS[4] = {1, 4, 7, 10};
const uint8_t GREEN_PINS[4] = {2, 5, 8, 11};

unsigned long captureIntervalMs = 15000;
unsigned long lastHeartbeat = 0;
unsigned long lastCapture = 0;

void applySignal(const String& lane, const String& phase) {
  int active = lane.substring(4).toInt() - 1;
  for (int i = 0; i < 4; i++) {
    lampExpander.digitalWrite(RED_PINS[i], i != active || phase == "RED");
    lampExpander.digitalWrite(YELLOW_PINS[i], i == active && phase == "YELLOW");
    lampExpander.digitalWrite(GREEN_PINS[i], i == active && phase == "GREEN");
  }
}

void configureCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = CAM_PIN_D0; config.pin_d1 = CAM_PIN_D1;
  config.pin_d2 = CAM_PIN_D2; config.pin_d3 = CAM_PIN_D3;
  config.pin_d4 = CAM_PIN_D4; config.pin_d5 = CAM_PIN_D5;
  config.pin_d6 = CAM_PIN_D6; config.pin_d7 = CAM_PIN_D7;
  config.pin_xclk = CAM_PIN_XCLK; config.pin_pclk = CAM_PIN_PCLK;
  config.pin_vsync = CAM_PIN_VSYNC; config.pin_href = CAM_PIN_HREF;
  config.pin_sccb_sda = CAM_PIN_SIOD; config.pin_sccb_scl = CAM_PIN_SIOC;
  config.pin_pwdn = CAM_PIN_PWDN; config.pin_reset = CAM_PIN_RESET;
  config.xclk_freq_hz = 8000000; // Stable limit for classic ESP32 parallel capture.
  config.pixel_format = PIXFORMAT_RGB565; // OV7670 does not output native JPEG.
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 14;
  config.fb_count = psramFound() ? 2 : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;
  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera initialization failed. Verify OV7670 pin map and XCLK.");
  }
}

void readServerResponse(const String& json) {
  JsonDocument document;
  if (deserializeJson(document, json)) return;
  String lane = document["signal"]["currentLane"] | "";
  String phase = document["signal"]["phase"] | "";
  String operationStatus = document["signal"]["operationStatus"] | "stopped";
  if (operationStatus == "running" && lane.length()) applySignal(lane, phase);
  else applySignal("lane1", "RED"); // applySignal turns every approach red for phase RED.
  int nextSeconds = document["nextCaptureSeconds"] | 0;
  if (nextSeconds == 0) nextSeconds = document["settings"]["cameraIntervalSeconds"] | 15;
  captureIntervalMs = max(5000, nextSeconds * 1000);
}

void sendHeartbeat() {
  HTTPClient http;
  http.begin(String(API_BASE_URL) + "/api/device/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.addHeader("X-API-Key", API_KEY);
  JsonDocument document;
  document["deviceId"] = DEVICE_ID;
  document["wifiSignal"] = WiFi.RSSI();
  document["firmwareVersion"] = "1.0.0";
  document["cameraStatus"] = "ready";
  String body;
  serializeJson(document, body);
  int status = http.POST(body);
  if (status == 200) readServerResponse(http.getString());
  else Serial.printf("Heartbeat failed: %d\n", status);
  http.end();
}

void captureAndUpload() {
  camera_fb_t* frame = esp_camera_fb_get();
  if (!frame) {
    Serial.println("Camera capture failed");
    return;
  }

  uint8_t* jpeg = nullptr;
  size_t jpegLength = 0;
  bool converted = frame2jpg(frame, 80, &jpeg, &jpegLength);
  esp_camera_fb_return(frame);
  if (!converted) {
    Serial.println("RGB565 to JPEG conversion failed");
    return;
  }

  String boundary = "----STCSBoundary";
  String head = "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"lane\"\r\n\r\n" + String(CAMERA_LANE) + "\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"image\"; filename=\"frame.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  WiFiClientSecure client;
  client.setInsecure(); // Replace with a Render CA certificate for production.
  HTTPClient http;
  http.begin(client, String(API_BASE_URL) + "/api/device/image");
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.addHeader("X-API-Key", API_KEY);

  size_t total = head.length() + jpegLength + tail.length();
  uint8_t* body = (uint8_t*)malloc(total);
  if (!body) {
    free(jpeg);
    return;
  }
  memcpy(body, head.c_str(), head.length());
  memcpy(body + head.length(), jpeg, jpegLength);
  memcpy(body + head.length() + jpegLength, tail.c_str(), tail.length());
  int status = http.POST(body, total);
  if (status == 200) readServerResponse(http.getString());
  else Serial.printf("Image upload failed: %d %s\n", status, http.getString().c_str());
  free(body);
  free(jpeg);
  http.end();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(CAM_PIN_SIOD, CAM_PIN_SIOC);
  if (!lampExpander.begin_I2C(0x20, &Wire)) Serial.println("MCP23017 not found");
  for (int i = 0; i < 4; i++) {
    lampExpander.pinMode(RED_PINS[i], OUTPUT);
    lampExpander.pinMode(YELLOW_PINS[i], OUTPUT);
    lampExpander.pinMode(GREEN_PINS[i], OUTPUT);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  configureCamera();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }
  unsigned long now = millis();
  if (now - lastHeartbeat >= 5000) {
    lastHeartbeat = now;
    sendHeartbeat();
  }
  if (now - lastCapture >= captureIntervalMs) {
    lastCapture = now;
    captureAndUpload();
  }
  delay(25);
}
