---
title: Arduino
pagina: outros-projetos
ordem: 1
ano: 2024–2026
links: []
blocos:
  - type: texto
    texto: |-
      Projetos com microcontrolador: sensores, automação caseira e umas gambiarras
      que deram certo.

      ### Regador automático

      Sensor de umidade no vaso, bomba de aquário e um relé. Rega quando o solo
      passa do limite e manda o registro para um arquivo de texto.

      ```cpp
      const int PINO_UMIDADE = A0;
      const int PINO_BOMBA = 7;

      void setup() {
        pinMode(PINO_BOMBA, OUTPUT);
        Serial.begin(9600);
      }

      void loop() {
        int umidade = analogRead(PINO_UMIDADE);
        digitalWrite(PINO_BOMBA, umidade > 600 ? HIGH : LOW);
        Serial.println(umidade);
        delay(60000);
      }
      ```
---
