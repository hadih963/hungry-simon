// Simulated MQTT-over-TLS link between the device and the cloud web app.
// In the real build the ESP32 uses a TLS MQTT client on port 8883; here we just log the traffic.
export const BROKER = 'mqtts://broker.hungrysimon.cloud:8883';
export const DEVICE_ID = 'hs-01';
const PREFIX = `hungrysimon/${DEVICE_ID}/`;

export function createCloud(logEl) {
  const handlers = new Map();
  let count = 0;

  function log(dir, topic, payload) {
    count++;
    const row = document.createElement('li');
    row.className = `mqtt-row ${dir}`;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    row.innerHTML = `<span class="mqtt-dir" title="${dir === 'pub' ? 'device publishes' : 'device receives'}">${dir === 'pub' ? '↑' : '↓'}</span>
      <span class="mqtt-time">${time}</span><code class="mqtt-topic"></code><code class="mqtt-payload"></code>`;
    row.querySelector('.mqtt-topic').textContent = PREFIX + topic;
    row.querySelector('.mqtt-payload').textContent = JSON.stringify(payload);
    logEl.prepend(row);
    while (logEl.children.length > 60) logEl.lastChild.remove();
  }

  return {
    /** Device → cloud */
    publish(topic, payload) { log('pub', topic, payload); },
    /** Device registers for a cloud → device topic */
    subscribe(topic, fn) { handlers.set(topic, fn); },
    /** Web app sends a command to the device (QoS 1, delivered after a short network delay) */
    send(topic, payload) {
      setTimeout(() => {
        log('sub', topic, payload);
        handlers.get(topic)?.(payload);
      }, 120 + Math.random() * 120);
    },
    get count() { return count; },
  };
}
