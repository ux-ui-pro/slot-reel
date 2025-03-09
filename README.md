<div align="center">
<br>

<h1>slot-reel</h1>

<p><sup>The `SlotReel` class is a feature-rich, customizable, and extensible implementation of a 3D slot machine using Three.js.
This library allows developers to integrate interactive slot machine experiences into web applications with ease.
</sup></p>

[![npm](https://img.shields.io/npm/v/slot-reel.svg?colorB=brightgreen)](https://www.npmjs.com/package/slot-reel)
[![GitHub package version](https://img.shields.io/github/package-json/v/ux-ui-pro/slot-reel.svg)](https://github.com/ux-ui-pro/slot-reel)
[![NPM Downloads](https://img.shields.io/npm/dm/slot-reel.svg?style=flat)](https://www.npmjs.org/package/slot-reel)

<a href="https://codepen.io/ux-ui/pen/qEWqoLa">Demo</a>

</div>
<br>

&#10148; **Install**
```bash
yarn add slot-reel
```
<br>

&#10148; **Import**
```javascript
import SlotReel from 'slot-reel';
```

<sub>For CommonJS environments, you may need to access the default export explicitly:</sub>
```javascript
const SlotReel = require('slot-reel').default;
```
<br>

&#10148; **Usage**
```javascript
const slotReel = new SlotReel({
  containerElSelector: '#slot-container',
  spinButtonSelector: '#spin-button',
  textureUrls: ['path/to/texture1.png', 'path/to/texture2.png', 'path/to/texture3.png'],
  cylindersCount: 3,
  geometryDimensions: [0.75, 0.75, 1],
  radialSegments: 64,
  symbolsPerReel: 5,
  initialSegments: [1, 3, 5],
  stopAtSegments: [2, 4, 5],
  queuedSpinStates: [
    { stopAtSegments: [3, 1, 4], callback: () => console.log('First spin done!') },
    { stopAtSegments: [5, 4, 3], callback: () => console.log('Second spin done!') }
  ],
  onAllSpinsComplete: () => console.log('All spins are complete!')
});

slotReel.init();
```
<br>

&#10148; **Options**

| Option                 | Type                       | Default     | Description                                                               |
|------------------------|----------------------------|-------------|---------------------------------------------------------------------------|
| `containerElSelector`  | `string`                   | `''`        | CSS selector for the container element.                                   |
| `spinButtonSelector`   | `string`                   | `''`        | CSS selector for the spin button.                                         |
| `cameraDistance`       | `number`                   | `10`        | Distance of the camera from the scene.                                    |
| `textureUrls`          | `(string \| URL)[]`        | `[]`        | Array of texture image URLs for the cylinders.                            |
| `geometryDimensions`   | `[number, number, number]` | `[1, 1, 1]` | Dimensions of the cylinder geometry (radius, height, depth).              |
| `radialSegments`       | `number`                   | `16`        | Number of radial segments on the cylinders.                               |
| `symbolsPerReel`       | `number`                   | `5`         | The number of symbols evenly distributed across the surface of each reel. |
| `cylinderSpacingRatio` | `number`                   | `0`         | Ratio for spacing between cylinders.                                      |
| `baseSpinSpeed`        | `number`                   | `1`         | Base speed for spinning cylinders.                                        |
| `spinAccelFactor`      | `number`                   | `30`        | Acceleration multiplier for spinning speed.                               |
| `initialSegments`      | `number[]`                 | `[]`        | Initial segment indices for each cylinder.                                |
| `stopAtSegments`       | `number[]`                 | `[]`        | Array defining the segments where cylinders should stop.                  |
| `queuedSpinStates`     | `SpinState[]`              | `[]`        | Queue of spin states, including stopping segments and callbacks.          |
| `onAllSpinsComplete`   | `() => void`               | `undefined` | Callback triggered when all spins in the queue are completed.             |
| `cylindersCount`       | `number`                   | `3`         | Number of cylinders in the slot machine.                                  |
| `decelerationEase`     | `number`                   | `1.5`       | Factor controlling deceleration smoothness.                               |
| `cylinderStopDelayMs`  | `number`                   | `250`       | Delay (ms) between stopping successive cylinders.                         |
<br>

&#10148; **Methods**

| Method                     | Description                                                                      |
|----------------------------|----------------------------------------------------------------------------------|
| `init()`                   | Initializes the slot reel, setting up the scene, cylinders, and event listeners. |
<br>

&#10148; **License**

SlotReel is released under the MIT license.
