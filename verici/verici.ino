/*
  VERİCİ KODU - ARDUINO NANO
  MPU6050 (I2C) + NRF24L01 (SPI)

  MPU6050 Bağlantıları:
  SDA -> A4
  SCL -> A5
  VCC -> 3.3V veya 5V
  GND -> GND

  NRF24L01 (YL-105) Bağlantıları:
  CE   -> 9
  CSN  -> 10
  MOSI -> 11
  MISO -> 12
  SCK  -> 13
  VCC  -> 5V
*/

#include <Wire.h>
#include <SPI.h>
#include <RF24.h>


RF24 radio(9, 10);
const byte address[6] = "00001";


const int buzzerPin = 8;


#define MPU_ADDR    0x68
#define ACCEL_SCALE 16384.0f  
#define GYRO_SCALE  131.0f    
#define ALPHA       0.98f     


struct Yonelim {
  float pitch;
  float roll;
  float yaw;
};


Yonelim yon = {0, 0, 0};
unsigned long sonZaman = 0;


void mpuBaslat() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // uyanık kal
  Wire.endTransmission(true);

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1B);  // GYRO_CONFIG
  Wire.write(0x00);  // ±250 °/s
  Wire.endTransmission(true);

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);  // ACCEL_CONFIG
  Wire.write(0x00);  // ±2g
  Wire.endTransmission(true);
}


void mpuOku(float &ax, float &ay, float &az,
            float &gx, float &gy, float &gz) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 14, true);

  int16_t rax = Wire.read() << 8 | Wire.read();
  int16_t ray = Wire.read() << 8 | Wire.read();
  int16_t raz = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();  
  int16_t rgx = Wire.read() << 8 | Wire.read();
  int16_t rgy = Wire.read() << 8 | Wire.read();
  int16_t rgz = Wire.read() << 8 | Wire.read();

  ax = rax / ACCEL_SCALE;
  ay = ray / ACCEL_SCALE;
  az = raz / ACCEL_SCALE;
  gx = rgx / GYRO_SCALE;
  gy = rgy / GYRO_SCALE;
  gz = rgz / GYRO_SCALE;
}


void setup() {
  Serial.begin(9600);
  Wire.begin();

  mpuBaslat();
  Serial.println("MPU6050 hazir.");
  
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  if (!radio.begin()) {
    Serial.println("NRF24L01 Bulunamadi! Baglantilari kontrol et.");
    while (1) {}
  }

  radio.openWritingPipe(address);
  radio.setPALevel(RF24_PA_MIN);
  radio.setDataRate(RF24_250KBPS);
  radio.stopListening();

  Serial.println("NRF24L01 hazir.");
  
  sonZaman = micros();
}


void loop() {
  float ax, ay, az, gx, gy, gz;
  mpuOku(ax, ay, az, gx, gy, gz);
  unsigned long simdi = micros();
  float dt = (simdi - sonZaman) / 1000000.0f;
  sonZaman = simdi;


  float accPitch = atan2(ay, az) * 180.0f / PI;
  float accRoll  = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0f / PI;


  yon.pitch = ALPHA * (yon.pitch + gx * dt) + (1.0f - ALPHA) * accPitch;
  yon.roll  = ALPHA * (yon.roll  + gy * dt) + (1.0f - ALPHA) * accRoll;
  yon.yaw  += gz * dt;    


  bool basari = radio.write(&yon, sizeof(yon));

  if (basari) {
    Serial.print("P:"); Serial.print(yon.pitch, 1);
    Serial.print("  R:"); Serial.print(yon.roll, 1);
    Serial.print("  Y:"); Serial.println(yon.yaw, 1);
  } else {
    Serial.println("Gonderim basarisiz!");
  }

  
  if (yon.roll < -30.0 || yon.roll > 30.0) {
    digitalWrite(buzzerPin, HIGH);
  } else {
    digitalWrite(buzzerPin, LOW);
  }

  delay(20);  // ~50 Hz
}
