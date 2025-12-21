/*
 * SIMPLE TEST - MASTER ONLY
 * Basic BLE central that scans and connects to slaves
 * No app connection - pure slave scanning test
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#define SLAVE_SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SLAVE_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEScan* pBLEScan = nullptr;
BLEClient* pClient1 = nullptr;
BLEClient* pClient2 = nullptr;
BLERemoteCharacteristic* pChar1 = nullptr;
BLERemoteCharacteristic* pChar2 = nullptr;

bool slave1Connected = false;
bool slave2Connected = false;

// Store found devices
std::vector<BLEAdvertisedDevice> foundSlaves;

class ScanCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String devName = advertisedDevice.getName().c_str();
    String devAddr = advertisedDevice.getAddress().toString().c_str();
    
    Serial.print("📡 Found: ");
    Serial.print(devName.length() > 0 ? devName : "<unnamed>");
    Serial.print(" | ");
    Serial.print(devAddr);
    Serial.print(" | RSSI: ");
    Serial.print(advertisedDevice.getRSSI());
    
    if (advertisedDevice.haveServiceUUID()) {
      Serial.print(" | Has UUID");
      
      if (advertisedDevice.isAdvertisingService(BLEUUID(SLAVE_SERVICE_UUID))) {
        Serial.println(" | ✅ SLAVE MATCH!");
        
        // Store it
        foundSlaves.push_back(advertisedDevice);
      } else {
        Serial.println(" | Different service");
      }
    } else {
      Serial.println(" | No UUID");
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("╔══════════════════════════════╗");
  Serial.println("║   MASTER - SIMPLE TEST       ║");
  Serial.println("╚══════════════════════════════╝");
  
  BLEDevice::init("NEOXALLE_TEST");
  
  Serial.print("📍 Master Address: ");
  Serial.println(BLEDevice::getAddress().toString().c_str());
  
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  
  Serial.println("✅ Master initialized");
  Serial.println("Starting scan in 2 seconds...\n");
  delay(2000);
}

void loop() {
  Serial.println("════════════════════════════════");
  Serial.println("🔍 SCANNING FOR SLAVES...");
  Serial.println("════════════════════════════════");
  
  foundSlaves.clear();
  
  // Scan for 10 seconds
  BLEScanResults* results = pBLEScan->start(10, false);
  
  Serial.println("\n════════════════════════════════");
  Serial.print("📊 Scan complete! Found ");
  Serial.print(results->getCount());
  Serial.print(" total devices, ");
  Serial.print(foundSlaves.size());
  Serial.println(" are NeoXalle slaves");
  Serial.println("════════════════════════════════\n");
  
  // List all found slaves
  if (foundSlaves.size() > 0) {
    Serial.println("🎯 SLAVE DEVICES FOUND:");
    for (int i = 0; i < foundSlaves.size(); i++) {
      Serial.print("  [");
      Serial.print(i);
      Serial.print("] ");
      Serial.print(foundSlaves[i].getName().c_str());
      Serial.print(" - ");
      Serial.println(foundSlaves[i].getAddress().toString().c_str());
    }
    Serial.println();
    
    // Try to connect to first two
    if (foundSlaves.size() >= 1 && !slave1Connected) {
      Serial.println("🔗 Attempting connection to Slave 1...");
      if (connectToSlave(foundSlaves[0], 1)) {
        slave1Connected = true;
        Serial.println("✅ Slave 1 connected!");
      } else {
        Serial.println("❌ Failed to connect to Slave 1");
      }
    }
    
    if (foundSlaves.size() >= 2 && !slave2Connected) {
      delay(1000);
      Serial.println("🔗 Attempting connection to Slave 2...");
      if (connectToSlave(foundSlaves[1], 2)) {
        slave2Connected = true;
        Serial.println("✅ Slave 2 connected!");
      } else {
        Serial.println("❌ Failed to connect to Slave 2");
      }
    }
  } else {
    Serial.println("⚠️ No NeoXalle slaves found in scan");
    Serial.println("Make sure slaves are powered on and advertising!");
  }
  
  pBLEScan->clearResults();
  
  Serial.println("\n💤 Waiting 15 seconds before next scan...\n");
  
  // Show connection status
  Serial.println("Current Status:");
  Serial.print("  Slave 1: ");
  Serial.println(slave1Connected ? "✅ Connected" : "❌ Not connected");
  Serial.print("  Slave 2: ");
  Serial.println(slave2Connected ? "✅ Connected" : "❌ Not connected");
  Serial.println();
  
  delay(15000);
}

bool connectToSlave(BLEAdvertisedDevice device, int slaveNum) {
  BLEClient* pClient = BLEDevice::createClient();
  
  Serial.print("  Connecting to ");
  Serial.print(device.getAddress().toString().c_str());
  Serial.println("...");
  
  if (!pClient->connect(&device)) {
    Serial.println("  ❌ Connection failed");
    delete pClient;
    return false;
  }
  
  Serial.println("  ✓ Connected");
  delay(300);
  
  BLERemoteService* pService = pClient->getService(SLAVE_SERVICE_UUID);
  if (pService == nullptr) {
    Serial.println("  ❌ Service not found");
    pClient->disconnect();
    delete pClient;
    return false;
  }
  
  Serial.println("  ✓ Service found");
  
  BLERemoteCharacteristic* pChar = pService->getCharacteristic(SLAVE_CHAR_UUID);
  if (pChar == nullptr) {
    Serial.println("  ❌ Characteristic not found");
    pClient->disconnect();
    delete pClient;
    return false;
  }
  
  Serial.println("  ✓ Characteristic found");
  
  // Store client
  if (slaveNum == 1) {
    pClient1 = pClient;
    pChar1 = pChar;
  } else {
    pClient2 = pClient;
    pChar2 = pChar;
  }
  
  return true;
}
