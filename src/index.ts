import {
  Clock,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from 'three';

type SpinState = {
  finalSegments: number[];
  callback: () => void;
};

interface CylinderState {
  currentSpeed: number;
  targetAngle: number | null;
  status: 'rest' | 'spinning' | 'stopping';
}

export interface SlotReelConfig {
  finalCallback?: () => void;
  finalSegments: number[];
  containerSelector: string;
  buttonSelector: string;
  textureURLs: (string | URL)[];
  cylinderGeometry: [number, number, number];
  rotationSegments: number;
  cylinderSegments: number;
  spacingRatio: number;
  rotationSpeed: number;
  spinSpeedMultiplier: number;
  initialSegments: number[];
  spinStates: SpinState[];
  cameraDistance?: number;
  cylinderCount: number;
}

export class SlotReel {
  static readonly defaultOptions: Partial<SlotReelConfig> = {
    containerSelector: '',
    buttonSelector: '',
    cameraDistance: 10,
    textureURLs: [],
    cylinderGeometry: [1, 1, 1],
    rotationSegments: 16,
    cylinderSegments: 5,
    spacingRatio: 0.1,
    rotationSpeed: 1,
    spinSpeedMultiplier: 30,
    initialSegments: [],
    spinStates: [],
    cylinderCount: 3,
    finalCallback: undefined,
    finalSegments: [],
  };

  static readonly STATES = Object.freeze({
    REST: 'rest' as const,
    SPINNING: 'spinning' as const,
    STOPPING: 'stopping' as const,
  });

  static readonly STOP_DELAY_MS = 2500;
  static readonly STOP_DELAY_BETWEEN_CYLINDERS_MS = 250;

  private readonly options: SlotReelConfig;
  private scene!: Scene;
  private camera!: OrthographicCamera;
  private renderer!: WebGLRenderer;
  private cylinders: Mesh[] = [];
  private clock: Clock = new Clock();
  private readonly cylinderStates: CylinderState[] = [];
  private currentGlobalState: 'rest' | 'spinning' | 'stopping' = SlotReel.STATES.REST;
  private spinQueue: SpinState[] = [];
  private currentSpinState: SpinState | null = null;
  private restAngles: number[] = [];
  private restTime = 0;
  private amplitude = 0.1;
  private frequency = 1.25;
  private phaseOffsets: number[] = [];
  private wobbleStartTime = 0;
  private wobbleEaseDuration = 1;
  private resizeObserver!: ResizeObserver;
  private resizeTimeout?: number;
  private buttonElement: HTMLButtonElement | null = null;

  constructor(options: Partial<SlotReelConfig> = {}) {
    this.options = { ...SlotReel.defaultOptions, ...options } as SlotReelConfig;

    this.cylinderStates = Array.from({ length: this.options.cylinderCount }, () => ({
      currentSpeed: this.options.rotationSpeed,
      targetAngle: null,
      status: SlotReel.STATES.REST,
    }));

    this.spinQueue = [...(this.options.spinStates ?? [])];
  }

  async init(): Promise<void> {
    const container = this.validateElement<HTMLDivElement>(this.options.containerSelector);

    if (!container) return;

    this.scene = new Scene();

    const { clientWidth: width, clientHeight: height } = container;

    this.createCamera(width / height, 1, this.options.cameraDistance ?? 10);
    this.createRenderer(width, height, container);

    const textures = await this.loadTextures(this.options.textureURLs);

    this.createCylinders(textures);
    this.positionCylinders(this.options.spacingRatio);
    this.phaseOffsets = this.cylinders.map(() => Math.random() * Math.PI * 2);
    this.initButton(this.options.buttonSelector);

    if (this.options.initialSegments?.length === this.options.cylinderCount) {
      this.setInitialSegments();
    }

    this.storeRestAngles();
    this.restTime = this.clock.getElapsedTime();
    this.wobbleStartTime = this.restTime;

    document.body.classList.remove('is-spinning-going', 'is-spinning-stopped');

    this.setupResizeObserver(container);

    requestAnimationFrame(this.animate);
  }

  private validateElement<T extends HTMLElement>(selector: string): T | null {
    return (document.querySelector(selector) as T) ?? null;
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

  private createRenderer(width: number, height: number, container: HTMLElement): void {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);

    container.appendChild(this.renderer.domElement);
  }

  private async loadTextures(textureURLs: (string | URL)[]): Promise<Texture[]> {
    const loader = new TextureLoader();
    const promises = textureURLs.map(async (urlLike) => {
      const url = urlLike instanceof URL ? urlLike.toString() : urlLike;
      const texture = await loader.loadAsync(url);

      texture.rotation = (3 * Math.PI) / 2;
      texture.center.set(0.5, 0.5);

      return texture;
    });

    return Promise.all(promises);
  }

  private createCylinders(textures: Texture[]): void {
    const { cylinderGeometry, rotationSegments, cylinderSegments, cylinderCount } = this.options;

    const geometry = new CylinderGeometry(
      ...cylinderGeometry,
      rotationSegments,
      cylinderSegments,
      true,
    );

    for (let i = 0; i < cylinderCount; i++) {
      const texture = textures[i % textures.length];
      const material = new MeshBasicMaterial({ map: texture });
      const cylinder = new Mesh(geometry, material);

      cylinder.rotation.z = Math.PI / 2;

      this.scene.add(cylinder);
      this.cylinders.push(cylinder);
    }
  }

  private positionCylinders(spacingRatio: number): void {
    const totalWidth = this.camera.right - this.camera.left;
    const count = this.cylinders.length;
    const scale = totalWidth / (count + spacingRatio * (count - 1));
    const spacing = scale * spacingRatio;

    this.cylinders.forEach((cylinder, index) => {
      cylinder.scale.set(scale, scale, scale);
      cylinder.position.x = this.camera.left + scale / 2 + index * (scale + spacing);
    });
  }

  private initButton(selector?: string): void {
    if (!selector) return;

    const button = this.validateElement<HTMLButtonElement>(selector);

    if (!button) return;

    this.buttonElement = button;
    this.buttonElement.addEventListener('pointerdown', this.startNextSpin);
  }

  private setInitialSegments(): void {
    const { initialSegments } = this.options;

    this.cylinders.forEach((cylinder, i) => {
      cylinder.rotation.x = this.getSegmentAngle(initialSegments[i]);
    });
  }

  private storeRestAngles(): void {
    this.restAngles = this.cylinders.map((cylinder) => cylinder.rotation.x);
  }

  private animate = (): void => {
    const deltaTime = this.clock.getDelta();
    const currentTime = this.clock.getElapsedTime();

    this.cylinders.forEach((cylinder, i) => {
      const state = this.cylinderStates[i];

      switch (state.status) {
        case SlotReel.STATES.SPINNING:
          cylinder.rotation.x += state.currentSpeed * deltaTime;
          break;

        case SlotReel.STATES.STOPPING:
          if (state.targetAngle !== null) {
            const diff = state.targetAngle - cylinder.rotation.x;

            if (Math.abs(diff) < 0.0001) {
              cylinder.rotation.x = state.targetAngle;
              state.status = SlotReel.STATES.REST;
            } else {
              const decelerationFactor = Math.min(1, Math.abs(diff) / (2 * Math.PI));
              const speed = state.currentSpeed * decelerationFactor;
              cylinder.rotation.x += Math.sign(diff) * speed * deltaTime;
            }
          }
          break;

        case SlotReel.STATES.REST:
          if (this.currentGlobalState === SlotReel.STATES.REST) {
            const elapsed = currentTime - this.wobbleStartTime;
            const easedAmplitude = Math.min(
              this.amplitude,
              (elapsed / this.wobbleEaseDuration) * this.amplitude,
            );

            cylinder.rotation.x =
              this.restAngles[i] +
              easedAmplitude * Math.sin(currentTime * this.frequency + this.phaseOffsets[i]);
          }
          break;

        default:
          break;
      }
    });

    if (this.currentGlobalState === SlotReel.STATES.STOPPING) {
      const allRest = this.cylinderStates.every((cs) => cs.status === SlotReel.STATES.REST);

      if (allRest) {
        this.finalizeSpin();
      }
    }

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.animate);
  };

  private startNextSpin = (): void => {
    if (this.currentGlobalState !== SlotReel.STATES.REST || !this.spinQueue.length) return;

    document.body.classList.remove('is-spinning-stopped');
    document.body.classList.add('is-spinning-going');

    this.currentSpinState = this.spinQueue.shift() ?? null;

    if (!this.currentSpinState) return;

    this.currentGlobalState = SlotReel.STATES.SPINNING;

    this.cylinderStates.forEach((state) => {
      state.currentSpeed = this.options.rotationSpeed * this.options.spinSpeedMultiplier;
      state.status = SlotReel.STATES.SPINNING;
    });

    const finalSegments =
      this.currentSpinState.finalSegments.length === this.options.cylinderCount
        ? this.currentSpinState.finalSegments
        : this.currentSpinState.finalSegments.slice(0, this.options.cylinderCount);

    this.options.finalSegments = finalSegments;

    setTimeout(() => {
      this.currentGlobalState = SlotReel.STATES.STOPPING;

      this.cylinders.forEach((cylinder, i) => {
        setTimeout(() => {
          const state = this.cylinderStates[i];
          const segment = finalSegments[i];
          const targetAngle = this.getSegmentAngle(segment);
          const fullRotations = Math.floor(cylinder.rotation.x / (2 * Math.PI)) + 2;

          state.targetAngle = targetAngle + fullRotations * 2 * Math.PI;
          state.status = SlotReel.STATES.STOPPING;
        }, i * SlotReel.STOP_DELAY_BETWEEN_CYLINDERS_MS);
      });
    }, SlotReel.STOP_DELAY_MS);
  };

  private finalizeSpin(): void {
    this.currentGlobalState = SlotReel.STATES.REST;
    this.storeRestAngles();
    this.restTime = this.clock.getElapsedTime();
    this.wobbleStartTime = this.restTime;

    document.body.classList.remove('is-spinning-going');
    document.body.classList.add('is-spinning-stopped');

    this.currentSpinState?.callback();

    if (!this.spinQueue.length && this.buttonElement) {
      this.buttonElement.removeEventListener('pointerdown', this.startNextSpin);

      if (this.options.finalCallback) {
        this.buttonElement.addEventListener('click', (event) => {
          event.preventDefault();

          this.options.finalCallback?.();
        });
      }
    }
  }

  private getSegmentAngle(segment: number): number {
    const { cylinderSegments } = this.options;
    const segmentAngle = (2 * Math.PI) / cylinderSegments;
    const offset = segmentAngle / 2;

    return 2 * Math.PI - ((segment - 1) * segmentAngle + offset);
  }

  private setupResizeObserver(container: HTMLElement): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
          }

          this.resizeTimeout = window.setTimeout(() => {
            this.onResize(container);
            this.resizeTimeout = undefined;
          }, 150);
        }
      }
    });

    this.resizeObserver.observe(container);
  }

  private onResize(container: HTMLElement): void {
    const { clientWidth: newWidth, clientHeight: newHeight } = container;
    const aspectRatio = newWidth / newHeight;
    const cameraSize = 1;

    this.camera.left = -cameraSize * aspectRatio;
    this.camera.right = cameraSize * aspectRatio;
    this.camera.top = cameraSize;
    this.camera.bottom = -cameraSize;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(newWidth, newHeight);
    this.positionCylinders(this.options.spacingRatio);
  }
}

export default SlotReel;
