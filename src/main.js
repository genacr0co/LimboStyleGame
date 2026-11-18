import { t } from './i18n.js';

class Forest extends Phaser.Scene {
  create() {
    const W = 1600, H = 720, GROUND = 600;
    this.cameras.main.setBackgroundColor('#8a8f94').setBounds(0, 0, W, H);
    // деревья-силуэты
    for (let x = 40; x < W; x += Phaser.Math.Between(90, 180))
      this.add.rectangle(x, GROUND, Phaser.Math.Between(14, 30), Phaser.Math.Between(300, 560), 0x000000).setOrigin(0.5, 1).setAlpha(Phaser.Math.FloatBetween(0.5, 1));
    this.add.rectangle(0, GROUND, W, H - GROUND, 0x000000).setOrigin(0);
    // герой
    this.hero = this.add.rectangle(200, GROUND, 22, 70, 0x000000).setOrigin(0.5, 1);
    this.target = this.hero.x;
    this.cameras.main.startFollow(this.hero, true, 0.08, 0.08);
    this.input.on('pointerdown', (p) => (this.target = Phaser.Math.Clamp(p.worldX, 20, W - 20)));
    this.add.text(640, 40, t('hint'), { color: '#222', fontSize: '22px' }).setOrigin(0.5).setScrollFactor(0);
  }
  update(_, dt) {
    const d = this.target - this.hero.x;
    if (Math.abs(d) > 2) this.hero.x += Math.sign(d) * Math.min(Math.abs(d), 0.18 * dt);
  }
}

new Phaser.Game({
  type: Phaser.AUTO, width: 1280, height: 720,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: Forest,
});
