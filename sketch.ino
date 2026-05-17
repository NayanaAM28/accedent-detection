#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "gps-data.h"

Adafruit_MPU6050 mpu;
const char* ssid = "Wokwi-GUEST"; // Wokwi built-in open internet routing bridge
const char* password = "";

// IMPORTANT CRITICAL STEP: Replace 192.168.1.X with your actual computer's IPv4 Address
const char* targetServer = "http:// 192.168.56.1.X:8000/api/update_location";

int currentRouteStep = 0;
float alertThreshold = 24.00; // Trigger parameter mapping sudden crash collision impacts

void setup() {
  Serial.begin(115200);
  Wire.begin();

  if (!mpu.begin()) {
    Serial.println("❌ MPU6050 Accelerometer connection breakdown.");
    while (1) { delay(10); }
  }
  Serial.println("✅ Accelerometer Array Diagnostic Status: Operational.");

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Network");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n🌐 Connected to Core Gateway successfully.");
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Compute absolute resultant acceleration vectors
  float totalAcceleration = sqrt(pow(a.acceleration.x, 2) + pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2));
  
  String operationalStatus = "Safe";
  
  // Evaluate vehicle state parameters against crash thresholds
  if (totalAcceleration > alertThreshold) {
    operationalStatus = "Emergency";
    Serial.println("\n🚨 CRASH THRESHOLD VIOLATION DETECTED!");
  }

  // Fetch the current step's coordinates to mimic a moving car
  float activeLat = routeLatitude[currentRouteStep];
  float activeLng = routeLongitude[currentRouteStep];

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(targetServer);
    http.addHeader("Content-Type", "application/json");

    // Construct the JSON payload containing Device ID, Coordinates, and Accident status
    String jsonBody = "{\"device_id\":\"VVCE-09\",\"status\":\"" + operationalStatus + 
                      "\",\"latitude\":" + String(activeLat, 6) + 
                      ",\"longitude\":" + String(activeLng, 6) + "}";

    int responseCode = http.POST(jsonBody);
    Serial.print("📡 Telemetry Sync -> Coordinates: ["); Serial.print(activeLat,4);
    Serial.print(", "); Serial.print(activeLng,4); Serial.print("] Server Status: ");
    Serial.println(responseCode);
    
    http.end();
  }

  // Advance to the next coordinate point in the route loop if the car is safe
  if (operationalStatus == "Safe") {
    currentRouteStep = (currentRouteStep + 1) % totalRouteSteps;
  }

  delay(2000); // Send an updated telemetry packet every 2 seconds
}