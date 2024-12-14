import {
  Clock,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  TextureLoader,
  WebGLRenderer,
} from 'three';

class SlotReel {
  static defaultOptions = {
    containerSelector: null,
    buttonSelector: null,
    width: 700,
    height: 250,
    cameraDistance: 10,
    textureURLs: [],
    cylinderGeometry: [1, 1, 1],
    rotationSegments: 16,
    cylinderSegments: 5,
    spacingRatio: 0.1,
    rotationSpeeds: [],
    spinSpeedMultiplier: 20,
    initialSegments: [],
    finalSegments: [],
    spinStates: [],
  };

  static STATES = {
    REST: 'rest',
    SPINNING: 'spinning',
    STOPPING: 'stopping',
  };

  static STOP_DELAY_MS = 2500;
  static STOP_THRESHOLD = 0.003;

  constructor(options = {}) {
    this.options = { ...SlotReel.defaultOptions, ...options };
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinders = [];
    this.clock = new Clock();

    this.currentState = SlotReel.STATES.REST;

    this.currentSpeeds = [...this.options.rotationSpeeds];

    this.targetAngles = [];
    this.stoppingStartTimes = [];
    this.initialAngles = [];

    this.spinStates = [...this.options.spinStates];
    this.currentSpinState = null;

    this.restAngles = [];
    this.restTime = 0;
    this.amplitude = 0.1;
    this.frequency = 1.25;
    this.phaseOffsets = [];
    this.wobbleStartTime = 0;
    this.wobbleEaseDuration = 1;

    this.animate = this.animate.bind(this);
  }

  async init() {
    const { containerSelector, width, height, cameraDistance, textureURLs, buttonSelector } =
      this.options;

    const container = document.querySelector(containerSelector);

    this.scene = new Scene();

    const aspectRatio = width / height;
    const cameraSize = 1;

    this.createCamera(aspectRatio, cameraSize, cameraDistance);
    this.createRenderer(width, height, container);

    const { cylinderGeometry, rotationSegments, cylinderSegments } = this.options;
    const geometry = new CylinderGeometry(
      ...cylinderGeometry,
      rotationSegments,
      cylinderSegments,
      true,
    );

    const textures = await this.loadTextures(textureURLs);

    this.createCylinders(textures, geometry);
    this.phaseOffsets = this.cylinders.map(() => Math.random() * Math.PI * 2);

    if (buttonSelector) {
      const button = document.querySelector(buttonSelector);

      if (button) {
        button.addEventListener('click', () => {
          this.startNextSpin();
        });
      }
    }

    const segmentAngle = (2 * Math.PI) / cylinderSegments;
    const correction = segmentAngle / 2;

    this.cylinders.forEach((cyl) => {
      cyl.rotation.x = -correction;
    });

    if (
      this.options.initialSegments &&
      this.options.initialSegments.length === this.cylinders.length
    ) {
      this.setInitialSegments();
    }

    this.storeRestAngles();
    this.restTime = this.clock.getElapsedTime();
    this.wobbleStartTime = this.restTime;

    requestAnimationFrame(this.animate);
  }

  createCamera(aspectRatio, cameraSize, cameraDistance) {
    this.camera = new OrthographicCamera(
      -cameraSize * aspectRatio,
      cameraSize * aspectRatio,
      cameraSize,
      -cameraSize,
      0.1,
      1000,
    );

    this.camera.position.z = cameraDistance;
  }

  createRenderer(width, height, container) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);

    container.appendChild(this.renderer.domElement);
  }

  async loadTextures(textureURLs) {
    const loader = new TextureLoader();
    const promises = textureURLs.map(
      (url) =>
        new Promise((resolve) => {
          const texture = loader.load(url, () => {
            texture.rotation = (3 * Math.PI) / 2;
            texture.center.set(0.5, 0.5);
            resolve(texture);
          });
        }),
    );

    return Promise.all(promises);
  }

  createCylinders(textures, geometry) {
    const { spacingRatio } = this.options;

    textures.forEach((texture) => {
      const material = new MeshBasicMaterial({ map: texture });
      const cylinder = new Mesh(geometry, material);

      cylinder.rotation.z = Math.PI / 2;

      this.scene.add(cylinder);
      this.cylinders.push(cylinder);
    });

    this.positionCylinders(spacingRatio);
  }

  positionCylinders(spacingRatio) {
    const numberOfCylinders = this.cylinders.length;
    const totalAvailableWidth = this.camera.right - this.camera.left;
    const scaleFactor =
      totalAvailableWidth / (numberOfCylinders + spacingRatio * (numberOfCylinders - 1));
    const spacing = scaleFactor * spacingRatio;

    this.cylinders.forEach((cyl) => {
      cyl.scale.set(scaleFactor, scaleFactor, scaleFactor);
    });

    let currentX = this.camera.left + scaleFactor / 2;

    this.cylinders.forEach((cyl, i) => {
      cyl.position.x = currentX;
      currentX += scaleFactor + (i < numberOfCylinders - 1 ? spacing : 0);
    });
  }

  updateDimensions(width, height) {
    this.options.width = width;
    this.options.height = height;

    const aspectRatio = width / height;
    const cameraSize = 1;

    this.camera.left = -cameraSize * aspectRatio;
    this.camera.right = cameraSize * aspectRatio;
    this.camera.top = cameraSize;
    this.camera.bottom = -cameraSize;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.positionCylinders(this.options.spacingRatio);
  }

  animate() {
    const deltaTime = this.clock.getDelta();
    const currentTime = this.clock.getElapsedTime();

    switch (this.currentState) {
      case SlotReel.STATES.SPINNING:
        this.updateSpinningCylinders(deltaTime);
        break;
      case SlotReel.STATES.STOPPING:
        this.updateStoppingCylinders(deltaTime);
        break;
      case SlotReel.STATES.REST:
      default:
        this.wobbleCylinders(currentTime);
        break;
    }

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.animate);
  }

  wobbleCylinders(currentTime) {
    const t = currentTime - this.restTime;
    const wobbleElapsed = currentTime - this.wobbleStartTime;
    const easedAmplitude = Math.min(
      this.amplitude,
      (wobbleElapsed / this.wobbleEaseDuration) * this.amplitude,
    );

    this.cylinders.forEach((cyl, i) => {
      cyl.rotation.x =
        this.restAngles[i] + easedAmplitude * Math.sin(t * this.frequency + this.phaseOffsets[i]);
    });
  }

  updateSpinningCylinders(deltaTime) {
    this.cylinders.forEach((cyl, index) => {
      cyl.rotation.x += this.currentSpeeds[index] * deltaTime;
    });
  }

  startNextSpin() {
    if (this.currentState !== SlotReel.STATES.REST) return;
    if (this.spinStates.length === 0) return;

    document.body.classList.remove('is-spinning-stopped');

    document.body.classList.add('is-spinning-going');

    this.currentSpinState = this.spinStates.shift();

    const { finalSegments } = this.currentSpinState;

    this.options.finalSegments = finalSegments;

    this.currentState = SlotReel.STATES.SPINNING;

    const { spinSpeedMultiplier } = this.options;

    this.currentSpeeds = this.currentSpeeds.map((speed) => speed * spinSpeedMultiplier);

    setTimeout(() => {
      this.stopOnSegments();
    }, SlotReel.STOP_DELAY_MS);
  }

  stopOnSegments() {
    const { finalSegments, cylinderSegments } = this.options;
    const segmentAngle = (2 * Math.PI) / cylinderSegments;
    const correction = segmentAngle / 2;

    this.cylinders.forEach((cyl, i) => {
      const segment = finalSegments[i];
      const targetAngle = 2 * Math.PI - ((segment - 1) * segmentAngle + correction);
      const fullRotations = Math.floor(cyl.rotation.x / (2 * Math.PI)) + 2;

      this.targetAngles[i] = targetAngle + fullRotations * 2 * Math.PI;
      this.initialAngles[i] = cyl.rotation.x;
      this.stoppingStartTimes[i] = this.clock.getElapsedTime();
    });

    this.currentState = SlotReel.STATES.STOPPING;
  }

  updateStoppingCylinders(deltaTime) {
    let allStopped = true;

    const { spinSpeedMultiplier } = this.options;

    this.cylinders.forEach((cyl, i) => {
      const currentAngle = cyl.rotation.x;
      const targetAngle = this.targetAngles[i];
      const remainingDistance = targetAngle - currentAngle;

      if (remainingDistance > SlotReel.STOP_THRESHOLD) {
        allStopped = false;

        const decelerationFactor = Math.min(1, remainingDistance / (2 * Math.PI));
        const speed = this.currentSpeeds[i] * decelerationFactor;

        cyl.rotation.x += speed * deltaTime;
      } else {
        cyl.rotation.x = targetAngle;
      }
    });

    if (allStopped) {
      this.currentState = SlotReel.STATES.REST;
      this.currentSpeeds = this.currentSpeeds.map((speed) => speed / spinSpeedMultiplier);

      this.storeRestAngles();
      this.restTime = this.clock.getElapsedTime();
      this.wobbleStartTime = this.restTime;

      document.body.classList.add('is-spinning-stopped');
      document.body.classList.remove('is-spinning-going');

      if (this.currentSpinState && typeof this.currentSpinState.callback === 'function') {
        this.currentSpinState.callback();
      }
    }
  }

  setInitialSegments() {
    const { initialSegments, cylinderSegments } = this.options;
    const segmentAngle = (2 * Math.PI) / cylinderSegments;
    const correction = segmentAngle / 2;

    this.cylinders.forEach((cyl, i) => {
      const segment = initialSegments[i];

      cyl.rotation.x = 2 * Math.PI - ((segment - 1) * segmentAngle + correction);
    });
  }

  storeRestAngles() {
    this.restAngles = this.cylinders.map((cyl) => cyl.rotation.x);
  }
}

export default SlotReel;
