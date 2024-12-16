<div align="center">
<br>

<h1>slot-reel</h1>

<p><sup>The SlotReel class is a modular and extensible implementation of a slot machine using Three.js. It allows you to create interactive slot machine experiences directly in the browser, leveraging 3D rendering for a visually engaging interface. The class manages key aspects of the slot machine, including rendering, animation, and user interactions. It supports customizable dimensions, spin speeds, and segment configurations, enabling you to tailor the experience to specific requirements. Additionally, the class features smooth animations for spinning and stopping, along with a subtle wobble effect during idle states, enhancing realism and improving the overall user experience.</sup></p>

[![npm](https://img.shields.io/npm/v/slot-reel.svg?colorB=brightgreen)](https://www.npmjs.com/package/slot-reel)
[![GitHub package version](https://img.shields.io/github/package-json/v/ux-ui-pro/slot-reel.svg)](https://github.com/ux-ui-pro/slot-reel)
[![NPM Downloads](https://img.shields.io/npm/dm/slot-reel.svg?style=flat)](https://www.npmjs.org/package/slot-reel)

<a href="https://codepen.io/ux-ui/pen/qEWqoLa">Demo</a>

</div>
<br>

&#10148; **Install**
```console
$ yarn add slot-reel
```

<br>

&#10148; **Import**

```javascript
import SlotReel from 'slot-reel';
```
<br>

&#10148; **Usage**
```javascript
const slotReel = new SlotReel({
  containerSelector: '#slot-container',
  buttonSelector: '#spin-button',
  textureURLs: [
    'path/to/texture1.png',
    'path/to/texture2.png',
    'path/to/texture3.png',
    'path/to/texture3.png',
  ],
  cylinderCount: 4,
  cylinderSegments: 5,
  initialSegments: [1, 2, 3, 3],
  spinStates: [
    { finalSegments: [3, 2, 1, 5], callback: () => console.log('first spin finished') },
    { finalSegments: [3, 5, 1, 1], callback: () => console.log('second spin finished') },
    { finalSegments: [1, 1, 2, 5], callback: () => console.log('third spin finished') },
  ]
});

slotReel.init();
```
<br>

&#10148; **Options**

| Option              |  Type  |  Default  | Description                                                    |
|:--------------------|:------:|:---------:|:---------------------------------------------------------------|
| containerSelector   | String |   null    | CSS selector for the container element.                        |
| buttonSelector      | String |   null    | CSS selector for the spin button.                              |
| cameraDistance      | Number |    10     | Distance of the camera from the scene.                         |
| textureURLs         | Array  |    []     | Array of texture image URLs.                                   |
| cylinderGeometry    | Array  | [1, 1, 1] | Geometry settings for the cylinders.                           |
| rotationSegments    | Number |    16     | Number of vertical segments on the cylinders.                  |
| cylinderSegments    | Number |     5     | Number of horizontal segments per cylinder.                    |
| spacingRatio        | Number |    0.1    | Spacing ratio between cylinders.                               |
| rotationSpeeds      | Array  |    []     | Initial rotation speeds for the cylinders.                     |
| spinSpeedMultiplier | Number |    20     | Multiplier for spin speed during spinning.                     |
| initialSegments     | Array  |    []     | Initial segment indices for each cylinder.                     |
| finalSegments       | Array  |    []     | Final segment indices for each cylinder.                       |
| spinStates          | Array  |    []     | Spin states with final segments and callbacks.                 |
| cylinderCount       | Number |     3     | Determines the number of cylinders displayed in the slot reel. |
<br>

&#10148; **Methods**

| Method                          | Description                                  |
|:--------------------------------|:---------------------------------------------|
| init()                          | Initializes the slot game.                   |
| startNextSpin()                 | Starts the next spin animation.              |
| updateDimensions(width, height) | Updates the canvas dimensions.               |
| stopOnSegments()                | Stops the cylinders on specific segments.    |
| setInitialSegments()            | Sets the initial segments for the cylinders. |
| storeRestAngles()               | Stores the resting angles of the cylinders.  |
<br>

&#10148; **License**

slot-reel is released under MIT license
