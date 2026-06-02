/*
  ALICI KODU - ARDUINO UNO

  NRF24L01 (YL-105) Bağlantıları:
  CE   -> 9
  CSN  -> 10
  MOSI -> 11
  MISO -> 12
  SCK  -> 13
  VCC  -> 5V
  
*/

#include <SPI.h>
#include <RF24.h>
RF24 radio(9, 10);
const byte address[6] = "00001"; 

unsigned long sonGonderim = 0;



struct Yonelim {
  float pitch;
  float roll;
  float yaw;
};


void setup() {
  Serial.begin(9600);

  if (!radio.begin()) {
    Serial.println("{\"hata\":\"NRF24L01 Bulunamadi!\"}");
    while (1) {}
  }

  radio.openReadingPipe(0, address);
  radio.setPALevel(RF24_PA_MIN);
  radio.setDataRate(RF24_250KBPS);
  radio.startListening();
}

void loop() {

  if (radio.available()) {
    Yonelim yon;
    radio.read(&yon, sizeof(yon));

    unsigned long simdi = millis();
    if (simdi - sonGonderim >= 100) {
      sonGonderim = simdi;


      //JSON Çıktısı: {"sapma": 10 , "yunuslama":20 ,"yuvarlanma" : -10}
      
      Serial.print("{\"sapma\":");
      Serial.print(yon.yaw, 2);
      Serial.print(",\"yunuslama\":");
      Serial.print(yon.pitch, 2);
      Serial.print(",\"yuvarlanma\":");
      Serial.print(yon.roll, 2);
      Serial.println("}");
    }
  }
}
