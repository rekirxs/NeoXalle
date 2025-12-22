#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <Adafruit_NeoPixel.h>
#include <MPU6050.h>
#include <Wire.h>

// Pin definitions
#define LED_PIN 10
#define LED_COUNT 24
#define SDA_PIN 8
#define SCL_PIN 9

// Auto-discovery settings
#define MAX_SLAVES 20
#define SCAN_DURATION 5  // Seconds to scan for existing slaves

// BLE Service/Characteristic UUIDs (must match master)
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Hardware
MPU6050 mpu;
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// BLE
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool masterConnected = false;

// Auto-discovered ID
int mySlaveID = -1;
bool usedIDs[MAX_SLAVES] = {false};

// State
bool ledActive = false;
unsigned long lightOnTime = 0;
uint32_t currentColor = 0;

// Tap detection using 1.8g acceleration
const float TAP_G_THRESHOLD = 1.8;  // 1.8g detection threshold
unsigned long lastTapTime = 0;
const unsigned long TAP_DEBOUNCE = 300;  // 300ms debounce

// Color palette
uint32_t colors[] = {
  strip.Color(255, 0, 0),     // Red
  strip.Color(0, 255, 0),     // Green
  strip.Color(0, 0, 255),     // Blue
  strip.Color(255, 255, 0),   // Yellow
  strip.Color(255, 0, 255),   // Magenta
  strip.Color(0, 255, 255),   // Cyan
  strip.Color(255, 128, 0),   // Orange
  strip.Color(128, 0, 255)    // Purple
};
const int NUM_COLORS = 8;

// Forward declarations
void processCommand(String command);
void showRandomColor();
int discoverMyID();

// ===== SCAN CALLBACKS FOR ID DISCOVERY ===== //
class IDScanCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String devName = advertisedDevice.getName().c_str();
    
    // Check if this is another NeoXalle slave
    if (devName.startsWith("NeoXalle_Slave_")) {
      // Extract the ID from the name
      int id = devName.substring(15).toInt();
      if (id >= 0 && id < MAX_SLAVES) {
        usedIDs[id] = true;
        Serial.print("📡 Found existing slave: ");
        Serial.print(devName);
        Serial.print(" (ID: ");
        Serial.print(id);
        Serial.println(")");
      }
    }
  }
};
void showColor(uint32_t color);
void turnOffLEDs();
bool detectTap();
void notifyMaster(String message);

// ===== BLE SERVER CALLBACKS ===== //
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    masterConnected = true;
    Serial.println("🔗 Master connected!");
  }

  void onDisconnect(BLEServer* pServer) {
    masterConnected = false;
    Serial.println("⚠️ Master disconnected");
    
    // Turn off LEDs
    turnOffLEDs();
    
    // Restart advertising
    BLEDevice::startAdvertising();
    Serial.println("📡 Advertising restarted");
  }
};

// ===== CHARACTERISTIC CALLBACKS ===== //
class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    if (value.length() > 0) {
      Serial.println("📩 Master -> Slave: " + value);
      processCommand(value);
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🎯 NeoXalle SLAVE Device");
  Serial.println("========================");
  Serial.println("🔍 Auto-discovering ID...");
  
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
    while (1) delay(10);
  }
  
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_8);
  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);
  mpu.setDLPFMode(MPU6050_DLPF_BW_20);
  Serial.println("✅ MPU6050 initialized");
  
  // Discover my ID by scanning for existing slaves
  mySlaveID = discoverMyID();
  
  Serial.println("════════════════════════════════");
  Serial.print("🆔 My Slave ID: ");
  Serial.println(mySlaveID);
  Serial.println("════════════════════════════════");
  
  // Initialize BLE with discovered ID
  String deviceName = "NeoXalle_Slave_" + String(mySlaveID);
  BLEDevice::init(deviceName.c_str());
  
  // Print the BLE address
  Serial.print("📍 BLE Address: ");
  Serial.println(BLEDevice::getAddress().toString().c_str());
  
  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  
  // Create BLE Service
  BLEService* pService = pServer->createService(SERVICE_UUID);
  
  // Create BLE Characteristic
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  pCharacteristic->setCallbacks(new CharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  
  // Start service
  pService->start();
  
  // Configure advertising
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  
  // Create scan response with name
  BLEAdvertisementData scanResponseData;
  scanResponseData.setName(deviceName.c_str());
  pAdvertising->setScanResponseData(scanResponseData);
  
  BLEDevice::startAdvertising();
  
  Serial.println("✅ BLE Slave active - Name: " + deviceName);
  Serial.println("📡 Waiting for master connection...");
}

int discoverMyID() {
  Serial.println("🔍 Scanning for existing slaves...");
  
  // Clear used IDs array
  for (int i = 0; i < MAX_SLAVES; i++) {
    usedIDs[i] = false;
  }
  
  // Initialize BLE temporarily for scanning
  BLEDevice::init("NeoXalle_Scanner");
  
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new IDScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  
  // Scan for existing slaves
  BLEScanResults* results = pBLEScan->start(SCAN_DURATION, false);
  
  Serial.print("Scan complete. Found ");
  Serial.print(results->getCount());
  Serial.println(" devices");
  
  pBLEScan->clearResults();
  BLEDevice::deinit(false);  // Deinit but keep config
  
  // Find first available ID
  for (int i = 0; i < MAX_SLAVES; i++) {
    if (!usedIDs[i]) {
      Serial.print("✅ Assigning ID: ");
      Serial.println(i);
      return i;
    }
  }
  
  // If all IDs taken (shouldn't happen), use 0
  Serial.println("⚠️ All IDs taken, using 0");
  return 0;
}

void loop() {
  // If LED is active, check for tap
  if (ledActive) {
    if (detectTap()) {
      unsigned long responseTime = millis() - lightOnTime;
      
      Serial.print("👆 Tap detected! Response time: ");
      Serial.print(responseTime);
      Serial.println("ms");
      
      // Turn off LEDs
      turnOffLEDs();
      ledActive = false;
      
      // Notify master
      notifyMaster("{\"event\":\"pressed\",\"time\":" + String(responseTime) + "}");
    }
  }
  
  delay(10);
}

void processCommand(String command) {
  // Expected: {"cmd":"on","color":"FF0000"} or {"cmd":"off"} or {"cmd":"on","color":"random"}
  
  if (command.indexOf("\"on\"") > 0) {
    Serial.println("💡 Turning lights ON");
    
    // Extract color
    String colorStr = "random";
    int colorIdx = command.indexOf("color");
    if (colorIdx > 0) {
      int valStart = command.indexOf(":", colorIdx) + 2;
      int valEnd = command.indexOf("\"", valStart);
      colorStr = command.substring(valStart, valEnd);
    }
    
    // Show color
    if (colorStr == "random") {
      showRandomColor();
    } else {
      // Parse hex color (format: "RRGGBB")
      if (colorStr.length() == 6) {
        long colorValue = strtol(colorStr.c_str(), NULL, 16);
        uint8_t r = (colorValue >> 16) & 0xFF;
        uint8_t g = (colorValue >> 8) & 0xFF;
        uint8_t b = colorValue & 0xFF;
        showColor(strip.Color(r, g, b));
      } else {
        showRandomColor();
      }
    }
    
    ledActive = true;
    lightOnTime = millis();
    
    // Notify master that light is on
    notifyMaster("{\"event\":\"light_on\",\"time\":" + String(lightOnTime) + "}");
  }
  else if (command.indexOf("\"off\"") > 0) {
    Serial.println("💡 Turning lights OFF");
    turnOffLEDs();
    ledActive = false;
    
    notifyMaster("{\"event\":\"light_off\"}");
  }
}

void showRandomColor() {
  int colorIndex = random(NUM_COLORS);
  currentColor = colors[colorIndex];
  showColor(currentColor);
  
  Serial.print("🎨 Showing color index: ");
  Serial.println(colorIndex);
}

void showColor(uint32_t color) {
  currentColor = color;
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

bool detectTap() {
  // Check debounce - prevent multiple triggers
  if (millis() - lastTapTime < TAP_DEBOUNCE) {
    return false;
  }
  
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  
  // Calculate total acceleration magnitude
  float accelMagnitude = sqrt((float)ax * ax + (float)ay * ay + (float)az * az);
  
  // Convert to g-force (scale factor 4096 for ±8g range)
  float gForce = accelMagnitude / 4096.0;
  
  // Detect if acceleration exceeds 1.8g
  if (gForce > TAP_G_THRESHOLD) {
    lastTapTime = millis();
    Serial.print("👆 TAP! G-force: ");
    Serial.print(gForce);
    Serial.println("g");
    return true;
  }
  
  return false;
}

void notifyMaster(String message) {
  if (masterConnected && pCharacteristic) {
    pCharacteristic->setValue(message.c_str());
    pCharacteristic->notify();
    Serial.println("📤 Slave -> Master: " + message);
  }
}
