import Phaser from 'phaser';

export class TankDeathMatchScene extends Phaser.Scene {
    private player1!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private player2!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private aiTanks!: Phaser.Physics.Arcade.Group;
    private bullets!: Phaser.Physics.Arcade.Group;
    private obstacles!: Phaser.Physics.Arcade.StaticGroup;
    
    private wasdKeys: any;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'TankDeathMatchScene' });
    }

    preload() {
        // Create tank sprites
        this.add.graphics()
            .fillStyle(0x00ff00)
            .fillRect(0, 0, 40, 30)
            .generateTexture('tank-p1', 40, 30);
            
        this.add.graphics()
            .fillStyle(0x0000ff)
            .fillRect(0, 0, 40, 30)
            .generateTexture('tank-p2', 40, 30);
            
        this.add.graphics()
            .fillStyle(0xff0000)
            .fillRect(0, 0, 40, 30)
            .generateTexture('tank-ai', 40, 30);
            
        this.add.graphics()
            .fillStyle(0xffff00)
            .fillRect(0, 0, 8, 4)
            .generateTexture('bullet', 8, 4);
            
        this.add.graphics()
            .fillStyle(0x8B4513)
            .fillRect(0, 0, 60, 60)
            .generateTexture('obstacle', 60, 60);
    }

    create() {
        // Create obstacles
        this.obstacles = this.physics.add.staticGroup();
        for (let i = 0; i < 8; i++) {
            const x = Phaser.Math.Between(100, 700);
            const y = Phaser.Math.Between(100, 500);
            this.obstacles.create(x, y, 'obstacle');
        }
        
        // Create bullet group
        this.bullets = this.physics.add.group();
        
        // Create players
        this.player1 = this.physics.add.sprite(100, 100, 'tank-p1');
        this.player1.setCollideWorldBounds(true);
        this.player1.setData('health', 100);
        this.player1.setData('playerId', 1);
        
        this.player2 = this.physics.add.sprite(700, 500, 'tank-p2');
        this.player2.setCollideWorldBounds(true);
        this.player2.setData('health', 100);
        this.player2.setData('playerId', 2);
        
        // Create AI tanks
        this.aiTanks = this.physics.add.group();
        for (let i = 0; i < 2; i++) {
            const aiTank = this.physics.add.sprite(
                Phaser.Math.Between(200, 600),
                Phaser.Math.Between(200, 400),
                'tank-ai'
            );
            aiTank.setCollideWorldBounds(true);
            aiTank.setData('health', 100);
            aiTank.setData('lastShot', 0);
            this.aiTanks.add(aiTank);
        }

        // Setup controls
        this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D');
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        // Physics collisions
        this.physics.add.collider([this.player1, this.player2], this.obstacles);
        this.physics.add.collider(this.aiTanks, this.obstacles);
        this.physics.add.collider(this.bullets, this.obstacles, this.destroyBullet, undefined, this);
        
        // Health bars
        this.add.text(10, 10, 'P1 Health: 100', { fontSize: '16px', color: '#00ff00' }).setDepth(100);
        this.add.text(10, 30, 'P2 Health: 100', { fontSize: '16px', color: '#0000ff' }).setDepth(100);
    }

    update() {
        // Player 1 controls (WASD)
        this.handleTankMovement(this.player1, this.wasdKeys.W, this.wasdKeys.S, this.wasdKeys.A, this.wasdKeys.D);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.fireBullet(this.player1);
        }
        
        // Player 2 controls (Arrows)
        this.handleTankMovement(this.player2, this.cursors.up, this.cursors.down, this.cursors.left, this.cursors.right);
        if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.fireBullet(this.player2);
        }
        
        // AI behavior
        this.aiTanks.children.entries.forEach((aiTank: any) => {
            this.updateAI(aiTank);
        });
    }
    
    handleTankMovement(tank: any, up: any, down: any, left: any, right: any) {
        const speed = 150;
        const rotSpeed = 3;
        
        if (up.isDown) {
            this.physics.velocityFromRotation(tank.rotation - Math.PI/2, speed, tank.body.velocity);
        } else if (down.isDown) {
            this.physics.velocityFromRotation(tank.rotation - Math.PI/2, -speed/2, tank.body.velocity);
        } else {
            tank.setVelocity(0);
        }
        
        if (left.isDown) {
            tank.setAngularVelocity(-rotSpeed);
        } else if (right.isDown) {
            tank.setAngularVelocity(rotSpeed);
        } else {
            tank.setAngularVelocity(0);
        }
    }
    
    fireBullet(tank: any) {
        const bullet = this.bullets.create(tank.x, tank.y, 'bullet');
        this.physics.velocityFromRotation(tank.rotation - Math.PI/2, 400, bullet.body.velocity);
        bullet.setData('owner', tank.getData('playerId') || 'ai');
        
        // Auto-destroy bullet after 2 seconds
        this.time.delayedCall(2000, () => {
            if (bullet.active) bullet.destroy();
        });
    }
    
    updateAI(aiTank: any) {
        // Simple AI: rotate towards nearest player and shoot
        const players = [this.player1, this.player2];
        let nearestPlayer = players[0];
        let minDistance = Phaser.Math.Distance.Between(aiTank.x, aiTank.y, players[0].x, players[0].y);
        
        players.forEach(player => {
            const distance = Phaser.Math.Distance.Between(aiTank.x, aiTank.y, player.x, player.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlayer = player;
            }
        });
        
        // Rotate towards player
        const angle = Phaser.Math.Angle.Between(aiTank.x, aiTank.y, nearestPlayer.x, nearestPlayer.y);
        aiTank.rotation = angle + Math.PI/2;
        
        // Move towards player
        this.physics.velocityFromRotation(angle, 100, aiTank.body.velocity);
        
        // Shoot periodically
        if (this.time.now - aiTank.getData('lastShot') > 1500) {
            this.fireBullet(aiTank);
            aiTank.setData('lastShot', this.time.now);
        }
    }
    
    destroyBullet(bullet: any) {
        bullet.destroy();
    }
}