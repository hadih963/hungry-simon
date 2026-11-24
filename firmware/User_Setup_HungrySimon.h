// TFT_eSPI settings for Hungry Simon: 2.8" ILI9341 320x240 on a DOIT ESP32 DevKit V1.
// Use it by copying it over libraries/TFT_eSPI/User_Setup.h (or include it from User_Setup_Select.h).
#define USER_SETUP_INFO "Hungry Simon ILI9341"

#define ILI9341_DRIVER

#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS    5    // chip select
#define TFT_DC    4    // data / command
#define TFT_RST  -1    // display RST wired to the ESP32 EN pin (resets together)
#define TFT_MISO -1    // not needed: we never read from the display
// Backlight (LED pin of the module) is wired to 3.3 V: always on while powered.

#define LOAD_GLCD      // font 1
#define LOAD_FONT2     // font 2
#define LOAD_FONT4     // font 4
#define SMOOTH_FONT

#define SPI_FREQUENCY  40000000
