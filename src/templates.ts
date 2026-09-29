import type { Template } from './types';

const none: string[] = [];

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'tpl_esp32_30',
    label: 'ESP32 DevKit',
    color: '#ffffff',
    pins: {
      top: ['VIN', 'GND', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN'],
      bottom: ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'],
      left: none,
      right: none,
    },
  },
  {
    id: 'tpl_resistor',
    label: 'R 10k',
    color: '#ffe8cc',
    pins: { top: none, bottom: none, left: ['a'], right: ['b'] },
  },
  {
    id: 'tpl_led',
    label: 'LED',
    color: '#ffe3e3',
    pins: { top: none, bottom: ['+', '-'], left: none, right: none },
  },
  {
    id: 'tpl_battery',
    label: 'Bateria 18650',
    color: '#ffffff',
    pins: { top: none, bottom: ['+', '-'], left: none, right: none },
    width: 280,
    height: 60,
  },
  {
    id: 'tpl_tp4056',
    label: 'TP4056',
    color: '#d0ebff',
    pins: { top: ['+OUT', '+B', 'B-', '-OUT'], bottom: none, left: none, right: none },
  },
  {
    id: 'tpl_button',
    label: 'Botão',
    color: '#e9ecef',
    pins: { top: none, bottom: none, left: ['1'], right: ['2'] },
  },
  {
    id: 'tpl_sensor3',
    label: 'Sensor',
    color: '#d3f9d8',
    pins: { top: none, bottom: none, left: ['VCC', 'OUT', 'GND'], right: none },
  },
  {
    id: 'tpl_capacitor',
    label: 'C 100uF',
    color: '#f3d9fa',
    pins: { top: none, bottom: ['+', '-'], left: none, right: none },
  },
];
