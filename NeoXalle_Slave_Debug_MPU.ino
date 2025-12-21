#include <Adafruit_NeoPixel.h>
#include <MPU6050.h>
#include <Wire.h>

// Pin definitions
#define LED_PIN 10
#define LED_COUNT 24
#define SDA_PIN 8
#define SCL_PIN 9

// Hardware
MPU6050 mpu;
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// Tap detection
const float TAP_THRESHOLD = 5000;  // Moderate threshold
unsigned long lastTapTime = 0;
const unsigned long TAP_DEBOUNCE = 300;  // 300ms debounce

// Colors
uint32_t RED = strip.Color(255, 0, 0);
uint32_t GREEN = strip.Color(0, 255, 0);
uint32_t BLUE = strip.Color(0, 0, 255);
uint32_t YELLOW = strip.Color(255, 255, 0);
uint32_t PURPLE = strip.Color(255, 0, 255);
uint32_t CYAN = strip.Color(0, 255, 255);

int colorIndex = 0;
uint32_t colors[] = {RED, GREEN, BLUE, YELLOW, PURPLE, CYAN};
int totalTaps = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🐛 MPU6050 DEBUG MODE");
  Serial.println("=====================");
  Serial.println("Testing tap detection only");
  Serial.println();
  
  // Initialize LED strip
  strip.begin();
  strip.show();
  strip.setBrightness(60);
  Serial.println("✅ NeoPixel initialized");
  
  // Initialize I2C and MPU6050
  Wire.begin(SDA_PIN, SCL_PIN);
  mpu.initialize();
  
  if (!mpu.testConnection()) {
    Serial.println("❌ MPU6050 not found!");
    // Flash red to indicate error
    for (int i = 0; i < 5; i++) {
      showColor(RED);
      delay(200);
      turnOffLEDs();
      delay(200);
    }
    while (1) delay(10);
  }
  
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_8);
  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);
  mpu.setDLPFMode(MPU6050_DLPF_BW_20);
  Serial.println("✅ MPU6050 initialized");
  
  // Flash green to indicate ready
  for (int i = 0; i < 3; i++) {
    showColor(GREEN);
    delay(150);
    turnOffLEDs();
    delay(150);
  }
  
  Serial.println();
  Serial.println("════════════════════════════════");
  Serial.println("🎯 READY TO TEST");
  Serial.println("════════════════════════════════");
  Serial.println("Tap the device and watch the lights!");
  Serial.println("Serial will show acceleration values");
  Serial.println();
  
  delay(1000);
}

void loop() {
  // Continuously monitor accelerometer
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  
  float accelMagnitude = sqrt((float)ax * ax + (float)ay * ay + (float)az * az);
  float gravity = 4096.0;
  float accelWithoutGravity = abs(accelMagnitude - gravity);
  
  // Show raw acceleration every 500ms for debugging
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    Serial.print("📊 Accel: ");
    Serial.print(accelWithoutGravity);
    Serial.print(" (Threshold: ");
    Serial.print(TAP_THRESHOLD);
    Serial.println(")");
    lastPrint = millis();
  }
  
  // Check for tap
  if (detectTap(accelWithoutGravity)) {
    totalTaps++;
    
    Serial.println();
    Serial.println("════════════════════════════════");
    Serial.println("👆 TAP DETECTED!");
    Serial.println("Acceleration: " + String(accelWithoutGravity));
    Serial.println("Total taps: " + String(totalTaps));
    Serial.println("════════════════════════════════");
    Serial.println();
    
    // Show next color
    showColor(colors[colorIndex]);
    colorIndex = (colorIndex + 1) % 6;
    
    delay(1000);  // Show color for 1 second
    turnOffLEDs();
  }
  
  delay(10);
}

bool detectTap(float accelValue) {
  // Check debounce
  if (millis() - lastTapTime < TAP_DEBOUNCE) {
    return false;
  }
  
  if (accelValue > TAP_THRESHOLD) {
    lastTapTime = millis();
    return true;
  }
  
  return false;
}

void showColor(uint32_t color) {
  for (int i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

void turnOffLEDs() {
  for (int i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, 0);
  }
  strip.show();
}
