const { SerialPort } = require('serialport');
const port = new SerialPort({ path: '/dev/tty.usbserial-1130', baudRate: 9600 }, (err) => {
  if (err) console.error('Açma hatası:', err.message);
  else console.log('Port açıldı!');
});
port.on('data', (data) => console.log('Veri:', data.toString('utf8')));
setTimeout(() => { port.close(); console.log('Bitti'); }, 5000);
