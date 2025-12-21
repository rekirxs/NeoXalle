#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#define DEVICE_NAME "NEOXALLE_DEBUG"
#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHAR_UUID "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

// Slave BLE Service/Characteristic UUIDs
#define SLAVE_SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SLAVE_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// App connection
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool appConnected = false;

// Slave connections
struct SlaveDevice {
  BLEClient* pClient;
  BLERemoteCharacteristic* pRemoteChar;
  String address;
  String name;
  bool connected;
};

SlaveDevice slaves[2];
int connectedSlaves = 0;
BLEScan* pBLEScan = nullptr;
BLEAdvertisedDevice* foundSlaves[2] = {nullptr, nullptr};
int foundSlaveCount = 0;

// Simple game state
int currentActiveSlaveIndex = 0;
bool gameRunning = false;
unsigned long lastPressTime = 0;
int totalPresses = 0;

// Forward declarations
void connectToSlave(BLEAdvertisedDevice device);
void scanAndConnectSlaves();
void startSimpleGame();
void onSlavePressed(int slaveIndex, unsigned long responseTime);
void activateNextSlave();
void notifyApp(String message);

// ===== APP SERVER CALLBACKS ===== 
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    appConnected = true;
    Serial.println("📱 App connected!");
    pServer->updatePeerMTU(pServer->getConnId(), 512);
  }

  void onDisconnect(BLEServer* pServer) {
    appConnected = false;
    Serial.println("📱 App disconnected");
  }
};

// ===== APP CHARACTERISTIC CALLBACKS ===== 
class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    if (value.length() > 0) {
      Serial.println("📩 App command: " + value);
      
      if (value.indexOf("start_debug_game") > 0) {
        startSimpleGame();
      } else if (value.indexOf("stop") > 0) {
        gameRunning = false;
        // Turn off all slaves
        for (int i = 0; i < 2; i++) {
          if (slaves[i].connected) {
            slaves[i].pRemoteChar->writeValue("{\"cmd\":\"off\"}", 13);
          }
        }
        Serial.println("🛑 Game stopped");
      }
    }
  }
};

// ===== SLAVE SCAN CALLBACKS ===== 
class SlaveScanCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (advertisedDevice.haveServiceUUID() && 
        advertisedDevice.isAdvertisingService(BLEUUID(SLAVE_SERVICE_UUID))) {
      
      String devName = advertisedDevice.getName().c_str();
      Serial.println("✅ Found slave: " + devName);
      
      // Check if not already stored
      bool alreadyFound = false;
      for (int i = 0; i < foundSlaveCount; i++) {
        if (foundSlaves[i] && foundSlaves[i]->getAddress().equals(advertisedDevice.getAddress())) {
          alreadyFound = true;
          break;
        }
      }
      
      if (!alreadyFound && foundSlaveCount < 2) {
        foundSlaves[foundSlaveCount] = new BLEAdvertisedDevice(advertisedDevice);
        foundSlaveCount++;
        Serial.println("📝 Stored slave " + String(foundSlaveCount) + "/2");
      }
    }
  }
};

// ===== SLAVE NOTIFICATION CALLBACK ===== 
class SlaveNotifyCallback : public BLEClientCallbacks {
  int slaveIndex;
  
public:
  SlaveNotifyCallback(int index) : slaveIndex(index) {}
  
  void onDisconnect(BLEClient* pClient) {
    Serial.println("⚠️ Slave " + String(slaveIndex) + " disconnected");
    slaves[slaveIndex].connected = false;
    connectedSlaves--;
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🐛 NeoXalle DEBUG MODE");
  Serial.println("======================");
  
  // Initialize slaves array
  for (int i = 0; i < 2; i++) {
    slaves[i].pClient = nullptr;
    slaves[i].pRemoteChar = nullptr;
    slaves[i].connected = false;
  }
  
  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  
  // Create BLE Server for app
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  
  BLEService* pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  pCharacteristic->setCallbacks(new CharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  
  pService->start();
  
  // Start advertising for app
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  
  BLEDevice::startAdvertising();
  
  Serial.println("✅ BLE Server active - Visible as 'NEOXALLE_DEBUG'");
  Serial.println("📡 Waiting for app connection...");
  Serial.println();
  
  // Wait for app connection
  Serial.println("Waiting 5 seconds for app to connect...");
  delay(5000);
  
  // Scan and connect to slaves
  scanAndConnectSlaves();
  
  // Auto-start game after 2 seconds
  if (connectedSlaves >= 2) {
    Serial.println();
    Serial.println("Auto-starting debug game in 2 seconds...");
    delay(2000);
    startSimpleGame();
  } else {
    Serial.println("⚠️ Not enough slaves connected. Need 2, found " + String(connectedSlaves));
  }
}

void loop() {
  // Monitor for slave notifications
  delay(100);
}

void scanAndConnectSlaves() {
  Serial.println("🔍 Scanning for slaves...");
  
  // Stop advertising during scan
  BLEDevice::getAdvertising()->stop();
  
  // Clear previous found devices
  for (int i = 0; i < foundSlaveCount; i++) {
    if (foundSlaves[i]) {
      delete foundSlaves[i];
      foundSlaves[i] = nullptr;
    }
  }
  foundSlaveCount = 0;
  
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new SlaveScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  
  // Scan for 10 seconds
  BLEScanResults* results = pBLEScan->start(10, false);
  
  Serial.println("Scan complete. Found " + String(foundSlaveCount) + " slaves");
  pBLEScan->clearResults();
  
  // Connect to found slaves
  for (int i = 0; i < foundSlaveCount && connectedSlaves < 2; i++) {
    if (foundSlaves[i]) {
      connectToSlave(*foundSlaves[i]);
      delay(1000);
    }
  }
  
  // Clean up
  for (int i = 0; i < foundSlaveCount; i++) {
    if (foundSlaves[i]) {
      delete foundSlaves[i];
      foundSlaves[i] = nullptr;
    }
  }
  foundSlaveCount = 0;
  
  // Resume advertising
  BLEDevice::startAdvertising();
  
  Serial.println("✅ Connected to " + String(connectedSlaves) + "/2 slaves");
}

void connectToSlave(BLEAdvertisedDevice device) {
  int slaveIndex = connectedSlaves;
  String deviceName = device.getName().c_str();
  
  Serial.println("🔗 Connecting to Slave " + String(slaveIndex) + ": " + deviceName);
  
  BLEClient* pClient = BLEDevice::createClient();
  pClient->setClientCallbacks(new SlaveNotifyCallback(slaveIndex));
  
  if (!pClient->connect(&device)) {
    Serial.println("❌ Connection failed");
    delete pClient;
    return;
  }
  
  Serial.println("✓ Connected");
  delay(300);
  
  // Get service and characteristic
  BLERemoteService* pRemoteService = pClient->getService(SLAVE_SERVICE_UUID);
  if (!pRemoteService) {
    Serial.println("❌ Service not found");
    pClient->disconnect();
    delete pClient;
    return;
  }
  
  BLERemoteCharacteristic* pRemoteChar = pRemoteService->getCharacteristic(SLAVE_CHAR_UUID);
  if (!pRemoteChar) {
    Serial.println("❌ Characteristic not found");
    pClient->disconnect();
    delete pClient;
    return;
  }
  
  // Register for notifications
  if (pRemoteChar->canNotify()) {
    pRemoteChar->registerForNotify([slaveIndex](BLERemoteCharacteristic* pChar, uint8_t* pData, size_t length, bool isNotify) {
      String data = String((char*)pData).substring(0, length);
      
      Serial.println("════════════════════════════════");
      Serial.println("🎯 SLAVE " + String(slaveIndex) + " EVENT");
      Serial.println("Raw data: " + data);
      
      // Parse response time
      if (data.indexOf("pressed") > 0) {
        int timeStart = data.indexOf("time") + 6;
        int timeEnd = data.indexOf("}", timeStart);
        if (timeEnd < 0) timeEnd = data.length();
        unsigned long responseTime = data.substring(timeStart, timeEnd).toInt();
        
        Serial.println("⏱️ Response Time: " + String(responseTime) + "ms");
        Serial.println("════════════════════════════════");
        
        onSlavePressed(slaveIndex, responseTime);
      } else {
        Serial.println("Event type: " + data);
        Serial.println("════════════════════════════════");
      }
    });
    Serial.println("✓ Notifications enabled");
  }
  
  // Store slave info
  slaves[slaveIndex].pClient = pClient;
  slaves[slaveIndex].pRemoteChar = pRemoteChar;
  slaves[slaveIndex].address = device.getAddress().toString().c_str();
  slaves[slaveIndex].name = deviceName;
  slaves[slaveIndex].connected = true;
  
  connectedSlaves++;
  
  Serial.println("✅ Slave " + String(slaveIndex) + " ready");
}

void startSimpleGame() {
  if (connectedSlaves < 2) {
    Serial.println("❌ Need 2 slaves to start game!");
    return;
  }
  
  gameRunning = true;
  totalPresses = 0;
  currentActiveSlaveIndex = 0;
  
  Serial.println();
  Serial.println("════════════════════════════════");
  Serial.println("🎮 SIMPLE DEBUG GAME STARTED");
  Serial.println("════════════════════════════════");
  Serial.println("Rules: Light turns on, tap the pod, light moves to next pod");
  Serial.println();
  
  notifyApp("{\"event\":\"debug_game_started\"}");
  
  // Activate first slave
  activateNextSlave();
}

void activateNextSlave() {
  if (!gameRunning) return;
  
  // Turn off all slaves first
  for (int i = 0; i < 2; i++) {
    if (slaves[i].connected) {
      slaves[i].pRemoteChar->writeValue("{\"cmd\":\"off\"}", 13);
    }
  }
  
  delay(200);
  
  // Activate current slave with random color
  if (slaves[currentActiveSlaveIndex].connected) {
    String command = "{\"cmd\":\"on\",\"color\":\"random\"}";
    slaves[currentActiveSlaveIndex].pRemoteChar->writeValue(command.c_str(), command.length());
    
    Serial.println("💡 Slave " + String(currentActiveSlaveIndex) + " (" + slaves[currentActiveSlaveIndex].name + ") is now ACTIVE - PRESS IT!");
    lastPressTime = millis();
  }
}

void onSlavePressed(int slaveIndex, unsigned long responseTime) {
  if (!gameRunning) {
    Serial.println("⚠️ Game not running, ignoring press");
    return;
  }
  
  Serial.println();
  Serial.println("════════════════════════════════");
  
  if (slaveIndex == currentActiveSlaveIndex) {
    Serial.println("✅ CORRECT! Slave " + String(slaveIndex) + " was active");
    Serial.println("⏱️ Response time: " + String(responseTime) + "ms");
    totalPresses++;
    Serial.println("📊 Total presses: " + String(totalPresses));
    
    // Notify app
    notifyApp("{\"event\":\"correct_press\",\"slave\":" + String(slaveIndex) + ",\"time\":" + String(responseTime) + ",\"total\":" + String(totalPresses) + "}");
    
    // Move to next slave
    currentActiveSlaveIndex = (currentActiveSlaveIndex + 1) % 2;
    
    Serial.println("🔄 Switching to Slave " + String(currentActiveSlaveIndex));
    Serial.println("════════════════════════════════");
    Serial.println();
    
    delay(500);
    activateNextSlave();
    
  } else {
    Serial.println("❌ WRONG! Slave " + String(slaveIndex) + " pressed but Slave " + String(currentActiveSlaveIndex) + " is active");
    Serial.println("⚠️ Press the lit-up pod!");
    Serial.println("════════════════════════════════");
    Serial.println();
    
    notifyApp("{\"event\":\"wrong_press\",\"slave\":" + String(slaveIndex) + "}");
  }
}

void notifyApp(String message) {
  if (appConnected && pCharacteristic) {
    pCharacteristic->setValue(message.c_str());
    pCharacteristic->notify();
  }
}
