/*
 * TEST - SLAVE 2 AS SCANNER
 * Check if Slave 2's ESP32 can scan and find other BLE devices
 * This tests if the hardware itself can detect broadcasts
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

BLEScan* pBLEScan = nullptr;

class ScanCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String devName = advertisedDevice.getName().c_str();
    String devAddr = advertisedDevice.getAddress().toString().c_str();
    
    Serial.print("📡 Found: ");
    Serial.print(devName.length() > 0 ? devName : "<unnamed>");
    Serial.print(" | Addr: ");
    Serial.print(devAddr);
    Serial.print(" | RSSI: ");
    Serial.print(advertisedDevice.getRSSI());
    
    // Highlight if it's the Master or another Slave
    if (devName.indexOf("NEOXALLE") >= 0 || devName.indexOf("NeoXalle") >= 0) {
      Serial.println(" | 🎯 NEOXALLE DEVICE!");
    } else if (advertisedDevice.haveServiceUUID()) {
      Serial.println(" | Has UUID");
    } else {
      Serial.println(" | No UUID");
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║  SLAVE 2 ESP32 - SCANNER TEST       ║");
  Serial.println("║  Testing if this ESP32 can scan     ║");
  Serial.println("╚══════════════════════════════════════╝");
  
  BLEDevice::init("Slave2_Scanner");
  
  Serial.print("📍 This ESP32 Address: ");
  Serial.println(BLEDevice::getAddress().toString().c_str());
  
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  
  Serial.println("\n✅ Scanner initialized");
  Serial.println("Starting scan in 2 seconds...");
  Serial.println("\n💡 EXPECTED RESULTS:");
  Serial.println("  - Should find NEOXALLE Master");
  Serial.println("  - Should find NeoXalle_Slave_1 (if powered on)");
  Serial.println("  - Should find other nearby BLE devices");
  Serial.println();
  
  delay(2000);
}

void loop() {
  Serial.println("════════════════════════════════════════");
  Serial.println("🔍 SCANNING FOR ALL BLE DEVICES...");
  Serial.println("════════════════════════════════════════");
  
  // Scan for 10 seconds
  BLEScanResults* results = pBLEScan->start(10, false);
  
  Serial.println("\n════════════════════════════════════════");
  Serial.print("📊 Scan complete! Found ");
  Serial.print(results->getCount());
  Serial.println(" devices");
  Serial.println("════════════════════════════════════════\n");
  
  pBLEScan->clearResults();
  
  Serial.println("💤 Waiting 15 seconds before next scan...\n");
  delay(15000);
}
