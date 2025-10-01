import Phaser from 'phaser';

export type InputCallbacks = {
  onUse: (slot: 0 | 1) => void;
  onPickup: () => boolean;
  onStartSearch: () => void;
  onDrop: (slot: 0 | 1) => void;
  onCraft: () => void;
  onSearchInterrupted: () => void;
};

export type InputUpdateOptions = {
  speed: number;
  searching: boolean;
  knockbackActive: boolean;
};

export type InputUpdateResult = {
  moving: boolean;
  attemptingMovement: boolean;
  facing: 'up' | 'down' | 'left' | 'right';
};

export class InputSystem {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyPick!: Phaser.Input.Keyboard.Key;
  private keyDrop!: Phaser.Input.Keyboard.Key;
  private keyCraft!: Phaser.Input.Keyboard.Key;

  private aimAngle = -Math.PI / 2;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';
  private player?: Phaser.Physics.Arcade.Sprite;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: InputCallbacks,
  ) {}

  create() {
    this.cursors = this.scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Phaser.Types.Input.Keyboard.CursorKeys;
    this.keyPick = this.scene.input.keyboard!.addKey('E');
    this.keyDrop = this.scene.input.keyboard!.addKey('G');
    this.keyCraft = this.scene.input.keyboard!.addKey('R');

    this.scene.input.mouse?.disableContextMenu();
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.scene.input.on('pointerdown', this.handlePointerDown);

    this.updateAimFromPointer();
  }

  setPlayer(player: Phaser.Physics.Arcade.Sprite) {
    this.player = player;
  }

  reset() {
    this.facing = 'down';
    this.aimAngle = -Math.PI / 2;
  }

  getAimAngle() {
    return this.aimAngle;
  }

  update(
    player: Phaser.Physics.Arcade.Sprite,
    options: InputUpdateOptions,
  ): InputUpdateResult {
    this.updateAimFromPointer();

    const body = player.body as Phaser.Physics.Arcade.Body;

    if (options.knockbackActive) {
      body.velocity.scale(0.9);
    } else {
      body.setVelocity(0, 0);
    }

    const left = this.cursors.left?.isDown;
    const right = this.cursors.right?.isDown;
    const up = this.cursors.up?.isDown;
    const down = this.cursors.down?.isDown;

    const attemptingMovement = Boolean(left || right || up || down);

    if (options.searching && attemptingMovement) {
      this.callbacks.onSearchInterrupted();
    }

    if (!options.searching && !options.knockbackActive) {
      if (left) body.setVelocityX(-options.speed);
      if (right) body.setVelocityX(options.speed);
      if (up) body.setVelocityY(-options.speed);
      if (down) body.setVelocityY(options.speed);
    }

    const moving = body.deltaAbsX() > 0.5 || body.deltaAbsY() > 0.5;

    if (moving) {
      const absX = Math.abs(body.velocity.x);
      const absY = Math.abs(body.velocity.y);
      if (absX > absY) {
        this.facing = body.velocity.x > 0 ? 'right' : 'left';
      } else if (absY > 0) {
        this.facing = body.velocity.y > 0 ? 'down' : 'up';
      }
    } else if (attemptingMovement) {
      if (left) this.facing = 'left';
      else if (right) this.facing = 'right';
      else if (up) this.facing = 'up';
      else if (down) this.facing = 'down';
    }

    if (!options.searching) {
      if (Phaser.Input.Keyboard.JustDown(this.keyPick)) {
        const pickedUp = this.callbacks.onPickup();
        if (!pickedUp) {
          this.callbacks.onStartSearch();
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyDrop)) {
        this.callbacks.onDrop(0);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyCraft)) {
        this.callbacks.onCraft();
      }
    }

    return {
      moving,
      attemptingMovement,
      facing: this.facing,
    };
  }

  private handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    this.updateAimFromPointer(pointer);
  };

  private handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    this.updateAimFromPointer(pointer);
    if (pointer.leftButtonDown()) this.callbacks.onUse(0);
    if (pointer.rightButtonDown()) this.callbacks.onUse(1);
  };

  private updateAimFromPointer(pointer?: Phaser.Input.Pointer) {
    const p = pointer ?? this.scene.input.activePointer;
    if (!p || !this.player) return;
    const camera = this.scene.cameras.main;
    const worldPoint = camera.getWorldPoint(p.x, p.y);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    if (!Number.isNaN(angle)) {
      this.aimAngle = angle;
    }
  }
}
