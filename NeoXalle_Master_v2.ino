#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#define DEVICE_NAME "NEOXALLE"
#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHAR_UUID "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

// Slave BLE Service/Characteristic UUIDs
#define SLAVE_SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SLAVE_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// App connection
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool appConnected = false;
bool oldAppConnected = false;

// Slave connections
struct SlaveDevice {
  BLEClient* pClient;
  BLERemoteCharacteristic* pRemoteChar;
  String address;
  String name;
  bool connected;
  unsigned long lastPing;
};

SlaveDevice slaves[2];
int connectedSlaves = 0;
bool scanningForSlaves = false;
BLEScan* pBLEScan = nullptr;
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 10000; // 10 seconds between scans

// Store found devices during scan
BLEAdvertisedDevice* foundSlaves[2] = {nullptr, nullptr};
int foundSlaveCount = 0;

// Game state
String currentGameMode = "idle";
unsigned long gameStartTime = 0;
int gameDuration = 30000; // 30 seconds default
int targetSlaves = 2;

// Forward declarations
void processAppCommand(String command);
void connectToSlave(BLEAdvertisedDevice device);
void notifyApp(String message);
void notifySlaveEvent(int slaveIndex, String data);
void sendToSlave(int slaveIndex, String message);
void sendSlaveStatus();
void startSlaveScan();

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
      Serial.println("📩 App -> Master: " + value);
      processAppCommand(value);
    }
  }
};

// ===== SLAVE SCAN CALLBACKS ===== 
class SlaveScanCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String devName = advertisedDevice.getName().c_str();
    String devAddr = advertisedDevice.getAddress().toString().c_str();
    
    // Show ALL devices during scan for debugging
    Serial.print("📡 Device: ");
    Serial.print(devName.length() > 0 ? devName : "<no name>");
    Serial.print(" | Addr: ");
    Serial.print(devAddr);
    Serial.print(" | RSSI: ");
    Serial.print(advertisedDevice.getRSSI());
    
    // Check if it has our service UUID
    if (advertisedDevice.haveServiceUUID()) {
      Serial.print(" | Has UUID");
      if (advertisedDevice.isAdvertisingService(BLEUUID(SLAVE_SERVICE_UUID))) {
        Serial.println(" | ✅ MATCH!");
        
        Serial.print("🎯 Found slave: ");
        Serial.print(devName);
        Serial.print(" at ");
        Serial.println(devAddr);
        
        // Check if already connected to this address
        bool alreadyConnected = false;
        for (int i = 0; i < 2; i++) {
          if (slaves[i].connected && slaves[i].address == advertisedDevice.getAddress().toString().c_str()) {
            alreadyConnected = true;
            Serial.println("⚠️ Already connected to this device");
            break;
          }
        }
        
        // Store the device for connection after scan completes
        if (!alreadyConnected && foundSlaveCount < 2) {
          // Check if we already found this device in current scan
          bool alreadyFound = false;
          for (int i = 0; i < foundSlaveCount; i++) {
            if (foundSlaves[i] && foundSlaves[i]->getAddress().equals(advertisedDevice.getAddress())) {
              alreadyFound = true;
              break;
            }
          }
          
          if (!alreadyFound) {
            foundSlaves[foundSlaveCount] = new BLEAdvertisedDevice(advertisedDevice);
            foundSlaveCount++;
            Serial.print("✓ Stored for connection (");
            Serial.print(foundSlaveCount);
            Serial.println("/2)");
          } else {
            Serial.println("⚠️ Already stored in this scan");
          }
        } else {
          if (alreadyConnected) {
            Serial.println("⚠️ Skipped - already connected");
          } else if (foundSlaveCount >= 2) {
            Serial.println("⚠️ Skipped - queue full");
          }
        }
      } else {
        Serial.println(" | Different UUID");
      }
    } else {
      Serial.println(" | No UUID");
    }
  }
};

// ===== SLAVE NOTIFICATION CALLBACK ===== 
class SlaveNotifyCallback : public BLEClientCallbacks {
  int slaveIndex;
  
public:
  SlaveNotifyCallback(int index) : slaveIndex(index) {}
  
  void onDisconnect(BLEClient* pClient) {
    Serial.print("⚠️ Slave ");
    Serial.print(slaveIndex);
    Serial.println(" disconnected");
    
    slaves[slaveIndex].connected = false;
    connectedSlaves--;
    
    notifyApp("{\"event\":\"slave_disconnected\",\"slave\":" + String(slaveIndex) + "}");
  }
};

void notifySlaveEvent(int slaveIndex, String data) {
  Serial.println("📤 Slave " + String(slaveIndex) + " event: " + data);
  
  // Parse the event and forward to app
  String message = "{\"slave\":" + String(slaveIndex) + "," + data.substring(1);
  notifyApp(message);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🚀 NeoXalle MASTER Controller");
  Serial.println("==============================");
  
  // Initialize slaves array
  for (int i = 0; i < 2; i++) {
    slaves[i].pClient = nullptr;
    slaves[i].pRemoteChar = nullptr;
    slaves[i].connected = false;
    slaves[i].lastPing = 0;
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
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  
  BLEDevice::startAdvertising();
  
  Serial.println("✅ BLE Server active - Visible as 'NEOXALLE'");
  Serial.println("📡 Waiting for app connection...");
}

void loop() {
  // Handle app connection changes
  if (!appConnected && oldAppConnected) {
    delay(500);
    oldAppConnected = false;
    BLEDevice::startAdvertising();
    Serial.println("🔄 Advertising reactivated");
  }
  
  if (appConnected && !oldAppConnected) {
    Serial.println("✅ App connection established");
    oldAppConnected = true;
    
    // Start scanning for slaves after a short delay
    delay(1000);
    startSlaveScan();
  }
  
  // If app connected and not all slaves found, keep scanning (with cooldown)
  if (appConnected && connectedSlaves < targetSlaves && !scanningForSlaves) {
    if (millis() - lastScanTime > SCAN_COOLDOWN) {
      startSlaveScan();
    }
  }
  
  // Stop scanning once we have all slaves
  if (connectedSlaves >= targetSlaves && scanningForSlaves) {
    Serial.println("✅ All slaves connected - scanning stopped");
  }
  
  // Send slave status updates to app periodically
  if (appConnected) {
    static unsigned long lastStatusUpdate = 0;
    if (millis() - lastStatusUpdate > 2000) {
      sendSlaveStatus();
      lastStatusUpdate = millis();
    }
  }
  
  delay(50);
}

void startSlaveScan() {
  if (scanningForSlaves) return;
  
  // Don't scan if we already have all slaves
  if (connectedSlaves >= targetSlaves) {
    Serial.println("✅ All slaves already connected - skipping scan");
    return;
  }
  
  Serial.println("🔍 Scanning for slave devices...");
  scanningForSlaves = true;
  lastScanTime = millis();
  
  // Stop advertising during scan to avoid conflicts
  if (pServer) {
    BLEDevice::getAdvertising()->stop();
    Serial.println("⏸️ Advertising paused for scan");
  }
  
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
  
  // Scan for 8 seconds to catch all slaves
  BLEScanResults* foundDevices = pBLEScan->start(8, false);
  
  Serial.print("Scan complete. Found ");
  Serial.print(foundDevices->getCount());
  Serial.println(" devices");
  
  Serial.print("📊 Slaves stored for connection: ");
  Serial.println(foundSlaveCount);
  
  pBLEScan->clearResults();
  scanningForSlaves = false;
  
  // Now connect to found slaves
  if (foundSlaveCount > 0) {
    Serial.print("Attempting to connect to ");
    Serial.print(foundSlaveCount);
    Serial.println(" slave(s)...");
    
    for (int i = 0; i < foundSlaveCount && connectedSlaves < 2; i++) {
      if (foundSlaves[i]) {
        connectToSlave(*foundSlaves[i]);
        delay(1000); // Increased delay between connections
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
  } else {
    Serial.println("⚠️ No slaves found");
  }
  
  Serial.print("✅ Connection complete. ");
  Serial.print(connectedSlaves);
  Serial.println(" slave(s) connected");
  
  // Always resume advertising for app (even if not connected yet)
  if (pServer) {
    BLEDevice::startAdvertising();
    Serial.println("▶️ Advertising resumed");
  }
}

void connectToSlave(BLEAdvertisedDevice device) {
  if (connectedSlaves >= 2) {
    Serial.println("⚠️ Maximum slaves already connected");
    return;
  }
  
  String deviceName = device.getName().c_str();
  String deviceAddr = device.getAddress().toString().c_str();
  
  Serial.println("════════════════════════════════");
  Serial.println("🔗 CONNECTION ATTEMPT");
  Serial.println("Device Name: " + deviceName);
  Serial.println("Device Addr: " + deviceAddr);
  Serial.println("Current connected count: " + String(connectedSlaves));
  
  // Check if already connected to this device
  for (int i = 0; i < 2; i++) {
    if (slaves[i].connected && slaves[i].address == deviceAddr) {
      Serial.println("⚠️ Already connected to this slave at index " + String(i));
      return;
    }
  }
  
  int slaveIndex = connectedSlaves;
  
  Serial.print("🔗 Connecting to slave ");
  Serial.print(slaveIndex);
  Serial.print(" at ");
  Serial.println(device.getAddress().toString().c_str());
  
  BLEClient* pClient = BLEDevice::createClient();
  pClient->setClientCallbacks(new SlaveNotifyCallback(slaveIndex));
  
  // Try to connect with timeout
  if (!pClient->connect(&device)) {
    Serial.println("❌ Failed to connect to slave");
    delete pClient;
    return;
  }
  
  Serial.println("✅ Connected to slave " + String(slaveIndex));
  delay(300); // Increased delay after connection
  
  // Get the service
  BLERemoteService* pRemoteService = pClient->getService(SLAVE_SERVICE_UUID);
  if (pRemoteService == nullptr) {
    Serial.println("❌ Failed to find slave service");
    pClient->disconnect();
    delete pClient;
    return;
  }
  
  // Get the characteristic
  BLERemoteCharacteristic* pRemoteChar = pRemoteService->getCharacteristic(SLAVE_CHAR_UUID);
  if (pRemoteChar == nullptr) {
    Serial.println("❌ Failed to find slave characteristic");
    pClient->disconnect();
    delete pClient;
    return;
  }
  
  // Register for notifications
  if (pRemoteChar->canNotify()) {
    pRemoteChar->registerForNotify([slaveIndex](BLERemoteCharacteristic* pChar, uint8_t* pData, size_t length, bool isNotify) {
      String data = String((char*)pData).substring(0, length);
      notifySlaveEvent(slaveIndex, data);
    });
    Serial.println("✓ Notifications registered");
  }
  
  // Store slave info
  slaves[slaveIndex].pClient = pClient;
  slaves[slaveIndex].pRemoteChar = pRemoteChar;
  slaves[slaveIndex].address = device.getAddress().toString().c_str();
  slaves[slaveIndex].name = device.getName().c_str();
  slaves[slaveIndex].connected = true;
  slaves[slaveIndex].lastPing = millis();
  
  connectedSlaves++;
  
  Serial.println("════════════════════════════════");
  Serial.println("✅ SLAVE FULLY CONFIGURED");
  Serial.println("Slave Index: " + String(slaveIndex));
  Serial.println("Slave Name: " + slaves[slaveIndex].name);
  Serial.println("Slave Address: " + slaves[slaveIndex].address);
  Serial.println("Total Connected: " + String(connectedSlaves) + "/2");
  Serial.println("════════════════════════════════");
  
  notifyApp("{\"event\":\"slave_connected\",\"slave\":" + String(slaveIndex) + ",\"address\":\"" + slaves[slaveIndex].address + "\"}");
}

void processAppCommand(String command) {
  // Expected format: {"command":"start_game","mode":"1v1","duration":30,"slaves":2}
  // Or: {"command":"light_on","slave":0,"color":"FF0000"}
  // Or: {"command":"light_off","slave":0}
  
  if (command.indexOf("start_game") > 0) {
    // Parse game parameters
    Serial.println("🎮 Starting game mode...");
    currentGameMode = "active";
    gameStartTime = millis();
    
    // Extract duration if present
    int durIdx = command.indexOf("duration");
    if (durIdx > 0) {
      int valStart = command.indexOf(":", durIdx) + 1;
      int valEnd = command.indexOf(",", valStart);
      if (valEnd < 0) valEnd = command.indexOf("}", valStart);
      gameDuration = command.substring(valStart, valEnd).toInt() * 1000;
    }
    
    notifyApp("{\"event\":\"game_started\",\"duration\":" + String(gameDuration / 1000) + "}");
  }
  else if (command.indexOf("stop_game") > 0) {
    Serial.println("🛑 Stopping game...");
    currentGameMode = "idle";
    
    // Turn off all slaves
    for (int i = 0; i < 2; i++) {
      if (slaves[i].connected) {
        sendToSlave(i, "{\"cmd\":\"off\"}");
      }
    }
    
    notifyApp("{\"event\":\"game_stopped\"}");
  }
  else if (command.indexOf("light_on") > 0) {
    // Extract slave index
    int slaveIdx = command.indexOf("slave") > 0 ? 
                   command.substring(command.indexOf(":", command.indexOf("slave")) + 1, 
                   command.indexOf(",", command.indexOf("slave"))).toInt() : 0;
    
    // Extract color if present
    String color = "random";
    if (command.indexOf("color") > 0) {
      int colorStart = command.indexOf(":", command.indexOf("color")) + 2;
      int colorEnd = command.indexOf("\"", colorStart);
      color = command.substring(colorStart, colorEnd);
    }
    
    sendToSlave(slaveIdx, "{\"cmd\":\"on\",\"color\":\"" + color + "\"}");
  }
  else if (command.indexOf("light_off") > 0) {
    int slaveIdx = command.indexOf("slave") > 0 ? 
                   command.substring(command.indexOf(":", command.indexOf("slave")) + 1).toInt() : 0;
    
    sendToSlave(slaveIdx, "{\"cmd\":\"off\"}");
  }
  else if (command.indexOf("scan_slaves") > 0) {
    startSlaveScan();
  }
}

void sendToSlave(int slaveIndex, String message) {
  if (slaveIndex < 0 || slaveIndex > 1) return;
  if (!slaves[slaveIndex].connected) {
    Serial.println("⚠️ Slave " + String(slaveIndex) + " not connected");
    return;
  }
  
  Serial.println("📤 Master -> Slave " + String(slaveIndex) + ": " + message);
  slaves[slaveIndex].pRemoteChar->writeValue(message.c_str(), message.length());
}

void notifyApp(String message) {
  if (appConnected && pCharacteristic) {
    pCharacteristic->setValue(message.c_str());
    pCharacteristic->notify();
    Serial.println("📤 Master -> App: " + message);
  }
}

void sendSlaveStatus() {
  String status = "{\"event\":\"status\",\"slaves\":[";
  for (int i = 0; i < 2; i++) {
    if (i > 0) status += ",";
    status += "{\"id\":" + String(i) + ",\"connected\":" + (slaves[i].connected ? "true" : "false") + "}";
  }
  status += "]}";
  
  notifyApp(status);
  
} 
