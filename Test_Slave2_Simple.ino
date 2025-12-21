/*
 * SIMPLE TEST - SLAVE 2 ONLY
 * Basic BLE peripheral that just advertises and accepts connections
 * No LEDs, no sensors - pure BLE test
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool masterConnected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    masterConnected = true;
    Serial.println("✅ MASTER CONNECTED TO SLAVE 2!");
  }

  void onDisconnect(BLEServer* pServer) {
    masterConnected = false;
    Serial.println("❌ Master disconnected from Slave 2");
    
    // Restart advertising
    BLEDevice::startAdvertising();
    Serial.println("📡 Slave 2 advertising restarted");
  }
};

class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    if (value.length() > 0) {
      Serial.println("📩 Received: " + value);
      
      // Echo back
      pCharacteristic->setValue("Slave 2 received your message");
      pCharacteristic->notify();
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("╔══════════════════════════════╗");
  Serial.println("║   SLAVE 2 - SIMPLE TEST      ║");
  Serial.println("╚══════════════════════════════╝");
  
  // Initialize BLE with SLAVE 2 name
  BLEDevice::init("NeoXalle_Slave_2");
  
  Serial.print("📍 BLE Address: ");
  Serial.println(BLEDevice::getAddress().toString().c_str());
  Serial.println("🆔 Device Name: NeoXalle_Slave_2");
  
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
  
  // Configure advertising with explicit data
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  
  // Create advertisement data explicitly
  BLEAdvertisementData advertisementData;
  advertisementData.setName("NeoXalle_Slave_2");
  advertisementData.setCompleteServices(BLEUUID(SERVICE_UUID));
  advertisementData.setFlags(0x06); // BR/EDR not supported, LE General Discoverable
  
  // Create scan response data with name
  BLEAdvertisementData scanResponseData;
  scanResponseData.setName("NeoXalle_Slave_2");
  
  pAdvertising->setAdvertisementData(advertisementData);
  pAdvertising->setScanResponseData(scanResponseData);
  
  BLEDevice::startAdvertising();
  
  Serial.println("╔══════════════════════════════╗");
  Serial.println("║  ✅ SLAVE 2 ACTIVE           ║");
  Serial.println("║  📡 Broadcasting...          ║");
  Serial.println("║  🔍 Waiting for Master...    ║");
  Serial.println("╚══════════════════════════════╝");
}

void loop() {
  // Send heartbeat every 3 seconds when connected
  if (masterConnected) {
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 3000) {
      Serial.println("💓 Heartbeat - Slave 2 connected");
      lastHeartbeat = millis();
    }
  } else {
    static unsigned long lastAdvertising = 0;
    if (millis() - lastAdvertising > 5000) {
      Serial.println("📡 Still advertising... (Slave 2)");
      lastAdvertising = millis();
    }
  }
  
  delay(100);
}
