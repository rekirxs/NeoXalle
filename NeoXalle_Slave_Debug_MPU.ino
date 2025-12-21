#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;

#define SDA_PIN 4
#define SCL_PIN 5

void setup() {
  Serial.begin(115200);

  // Initialize I2C on ESP32-C3 (custom pins)
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000); // Fast I2C (400kHz)

  // Initialize MPU6050
  mpu.initialize();

  // Verify connection
  if (!mpu.testConnection()) {
    Serial.println("❌ MPU6050 NOT detected");
    while (true); // Stop execution
  }

  Serial.println("✅ MPU6050 connected successfully");
}

void loop() {
  // Nothing here — connection only
}
