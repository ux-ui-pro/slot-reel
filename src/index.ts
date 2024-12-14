import {
  Clock,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  TextureLoader,
  Texture,
  WebGLRenderer,
} from 'three';

type SpinState = {
  finalSegments: number[];
  callback: () => void;
};

interface SlotReelConfig {
  finalSegments: number[];
  containerSelector: string;
  buttonSelector: string;
  textureURLs: URL[];
  cylinderGeometry: [number, number, number];
  rotationSegments: number;
  cylinderSegments: number;
  spacingRatio: number;
  rotationSpeeds: number[];
  spinSpeedMultiplier: number;
  initialSegments: number[];
  spinStates: SpinState[];
  width?: number;
  height?: number;
  cameraDistance?: number;
}

class SlotReel {
  static defaultOptions: Partial<SlotReelConfig> = {
    containerSelector: '',
    buttonSelector: '',
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
    spinStates: [],
  };

  static STATES = Object.freeze({
    REST: 'rest',
    SPINNING: 'spinning',
    STOPPING: 'stopping',
  });

  static STOP_DELAY_MS = 2500;
  static STOP_THRESHOLD = 0.003;

  private readonly options: SlotReelConfig;
  private scene!: Scene;
  private camera!: OrthographicCamera;
  private renderer!: WebGLRenderer;
  private cylinders: Mesh[] = [];
  private clock: Clock = new Clock();

  private currentState: 'rest' | 'spinning' | 'stopping' = 'rest';
  private currentSpeeds: number[] = [];
  private targetAngles: number[] = [];

  private spinStates: SpinState[] = [];
  private currentSpinState: SpinState | null = null;

  private restAngles: number[] = [];
  private restTime = 0;
  private amplitude = 0.1;
  private frequency = 1.25;
  private phaseOffsets: number[] = [];
  private wobbleStartTime = 0;
  private wobbleEaseDuration = 1;

  constructor(options: Partial<SlotReelConfig> = {}) {
    this.options = { ...SlotReel.defaultOptions, ...options } as SlotReelConfig;
    this.currentSpeeds = [...(this.options.rotationSpeeds || [])];
    this.spinStates = [...(this.options.spinStates || [])];
  }

  async init(): Promise<void> {
    const {
      containerSelector,
      width = 700,
      height = 250,
      cameraDistance = 10,
      textureURLs,
      buttonSelector,
    } = this.options;

    const container = this.validateElement(containerSelector);

    this.scene = new Scene();
    this.createCamera(width / height, 1, cameraDistance);
    this.createRenderer(width, height, container);

    const textures = await this.loadTextures(textureURLs);

    this.createCylinders(textures);
    this.phaseOffsets = Array.from(
      { length: this.cylinders.length },
      () => Math.random() * Math.PI * 2,
    );

    this.initializeSegments(buttonSelector);
    this.restTime = this.clock.getElapsedTime();
    this.wobbleStartTime = this.restTime;

    document.body.classList.remove('is-spinning-going', 'is-spinning-stopped');

    requestAnimationFrame(this.animate.bind(this));
  }

  private validateElement(selector: string): HTMLElement | null {
    const element = document.querySelector(selector);

    if (!element) {
      return null;
    }

    return element as HTMLElement;
  }

  private createCamera(aspectRatio: number, cameraSize: number, cameraDistance: number): void {
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

  private createRenderer(width: number, height: number, container: HTMLElement | null): void {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);

    container?.appendChild(this.renderer.domElement);
  }

  private async loadTextures(textureURLs: URL[]): Promise<Texture[]> {
    const loader = new TextureLoader();

    return Promise.all(
      textureURLs.map((url) =>
        loader.loadAsync(url.toString()).then((texture) => {
          texture.rotation = (3 * Math.PI) / 2;
          texture.center.set(0.5, 0.5);

          return texture;
        }),
      ),
    );
  }

  private createCylinders(textures: Texture[]): void {
    const { cylinderGeometry, rotationSegments, cylinderSegments, spacingRatio } = this.options;
    const geometry = new CylinderGeometry(
      ...cylinderGeometry,
      rotationSegments,
      cylinderSegments,
      true,
    );

    textures.forEach((texture) => {
      const material = new MeshBasicMaterial({ map: texture });
      const cylinder = new Mesh(geometry, material);

      cylinder.rotation.z = Math.PI / 2;

      this.scene.add(cylinder);
      this.cylinders.push(cylinder);
    });

    this.positionCylinders(spacingRatio);
  }

  private positionCylinders(spacingRatio: number): void {
    const totalWidth = this.camera.right - this.camera.left;
    const scale = totalWidth / (this.cylinders.length + spacingRatio * (this.cylinders.length - 1));
    const spacing = scale * spacingRatio;

    this.cylinders.forEach((cylinder, index) => {
      cylinder.scale.set(scale, scale, scale);
      cylinder.position.x = this.camera.left + scale / 2 + index * (scale + spacing);
    });
  }

  private initializeSegments(buttonSelector?: string): void {
    if (buttonSelector) {
      const button = this.validateElement(buttonSelector);

      button?.addEventListener('click', () => this.startNextSpin());
    }

    if (this.options.initialSegments?.length === this.cylinders.length) {
      this.setInitialSegments();
    }

    this.storeRestAngles();
  }

  private setInitialSegments(): void {
    const { initialSegments, cylinderSegments } = this.options;
    const segmentAngle = (2 * Math.PI) / cylinderSegments;
    const correction = segmentAngle / 2;

    this.cylinders.forEach((cylinder, i) => {
      const segment = initialSegments[i];
      cylinder.rotation.x = 2 * Math.PI - ((segment - 1) * segmentAngle + correction);
    });
  }

  private storeRestAngles(): void {
    this.restAngles = this.cylinders.map((cylinder) => cylinder.rotation.x);
  }

  private animate(): void {
    const deltaTime = this.clock.getDelta();
    const currentTime = this.clock.getElapsedTime();

    if (this.currentState === SlotReel.STATES.SPINNING) {
      this.updateSpinningCylinders(deltaTime);
    } else if (this.currentState === SlotReel.STATES.STOPPING) {
      this.updateStoppingCylinders(deltaTime);
    } else {
      this.wobbleCylinders(currentTime);
    }

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.animate.bind(this));
  }

  private wobbleCylinders(currentTime: number): void {
    const elapsed = currentTime - this.wobbleStartTime;
    const easedAmplitude = Math.min(
      this.amplitude,
      (elapsed / this.wobbleEaseDuration) * this.amplitude,
    );

    this.cylinders.forEach((cylinder, i) => {
      cylinder.rotation.x =
        this.restAngles[i] +
        easedAmplitude * Math.sin(currentTime * this.frequency + this.phaseOffsets[i]);
    });
  }

  private updateSpinningCylinders(deltaTime: number): void {
    this.cylinders.forEach((cylinder, i) => {
      cylinder.rotation.x += this.currentSpeeds[i] * deltaTime;
    });
  }

  private updateStoppingCylinders(deltaTime: number): void {
    let allStopped = true;

    this.cylinders.forEach((cylinder, i) => {
      const currentAngle = cylinder.rotation.x;
      const targetAngle = this.targetAngles[i];
      const remainingDistance = targetAngle - currentAngle;

      if (remainingDistance > SlotReel.STOP_THRESHOLD) {
        allStopped = false;

        const decelerationFactor = Math.min(1, remainingDistance / (2 * Math.PI));

        const speed = this.currentSpeeds[i] * decelerationFactor;

        cylinder.rotation.x += speed * deltaTime;
      } else {
        cylinder.rotation.x = targetAngle;
      }
    });

    if (allStopped) {
      this.finalizeSpin();
    }
  }

  private finalizeSpin(): void {
    this.currentState = SlotReel.STATES.REST;
    this.currentSpeeds = this.currentSpeeds.map(
      (speed) => speed / this.options.spinSpeedMultiplier,
    );
    this.storeRestAngles();
    this.restTime = this.clock.getElapsedTime();
    this.wobbleStartTime = this.restTime;

    document.body.classList.remove('is-spinning-going');
    document.body.classList.add('is-spinning-stopped');

    if (this.currentSpinState && typeof this.currentSpinState.callback === 'function') {
      this.currentSpinState.callback();
    }
  }

  private startNextSpin(): void {
    if (this.currentState !== SlotReel.STATES.REST || !this.spinStates.length) return;

    document.body.classList.remove('is-spinning-stopped');
    document.body.classList.add('is-spinning-going');

    this.currentSpinState = this.spinStates.shift() || null;

    if (!this.currentSpinState) return;

    this.options.finalSegments = this.currentSpinState.finalSegments;
    this.currentState = SlotReel.STATES.SPINNING;
    this.currentSpeeds = this.currentSpeeds.map(
      (speed) => speed * this.options.spinSpeedMultiplier,
    );

    setTimeout(() => this.stopOnSegments(), SlotReel.STOP_DELAY_MS);
  }

  private stopOnSegments(): void {
    const { finalSegments, cylinderSegments } = this.options;
    const segmentAngle = (2 * Math.PI) / cylinderSegments;
    const segmentOffset = Math.PI / cylinderSegments;

    this.cylinders.forEach((cylinder, i) => {
      const segment = finalSegments[i];
      const targetAngle = 2 * Math.PI - ((segment - 1) * segmentAngle + segmentOffset);
      const fullRotations = Math.floor(cylinder.rotation.x / (2 * Math.PI)) + 2;

      this.targetAngles[i] = targetAngle + fullRotations * 2 * Math.PI;
    });

    this.currentState = SlotReel.STATES.STOPPING;
  }

  updateDimensions(width: number, height: number): void {
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
}

export default SlotReel;
