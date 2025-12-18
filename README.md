# NeoXalle

NeoXalle is a Bluetooth Low Energy (BLE) mobile application designed to connect, monitor, and control a custom hardware device in real time.  
The project focuses on clean UI, reliable BLE communication, and a modular architecture built for future expansion.

---

## 🚀 Features

- 🔵 Bluetooth Low Energy (BLE) connection
- 📱 Minimalistic, modern UI
- 🔌 Device connection & disconnection handling
- 🧭 Tab-based navigation (Expo Router)
- ⚙️ Prepared structure for control & configuration tabs
- 🛠 Built with scalability in mind

---

## 🧠 Tech Stack

- **React Native**
- **Expo**
- **Expo Router (Tabs)**
- **TypeScript**
- **BLE (react-native-ble-plx)**
- **Android-first development**

---

## 📂 Project Structure

```text
app/
 └─ (tabs)/
     ├─ _layout.tsx      # Tab navigator
     ├─ index.tsx        # Connect / BLE screen
     └─ control.tsx      # Device control (WIP)
constants/
 └─ theme.ts             # App theme & colors
