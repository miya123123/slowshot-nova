<p align="center">
  <img src="public/assets/title.png" alt="Slowshot Nova タイトル画像" width="100%">
</p>

# Slowshot Nova

Slowshot Nova は、スワイプ中だけ時間を遅くできる、ブラウザ向けの弾幕サバイバルゲームです。

公開 URL: https://miya123123.github.io/slowshot-nova/

## ゲーム概要

プレイヤーは画面下部の自機を操作し、上空から出現する敵や敵弾を避けながら、20 秒間の生存を目指します。

スワイプ、または Shift キーを押している間は時間がスローになり、敵や敵弾の動きが遅くなります。スロー中に位置を調整し、指やキーを離した瞬間にカウンターショットで反撃します。

## ルール

- 20 秒間生き残るとクリアです。
- 敵本体または敵弾に 1 回でも当たるとゲームオーバーです。
- スローには使用可能時間があり、残量がなくなると一時的に使えなくなります。
- スロー残量は、スローを使っていない通常時間中に回復します。
- スロー中は敵だけでなく、自分の弾やゲーム内時間も遅くなります。
- 敵弾を撃ち消すとスコアが加算されます。
- 敵を撃破するとより多くのスコアが加算されます。

## 操作方法

### マウス・タッチ

- タップ: ショット
- スワイプ長押し: スロー移動
- スワイプ解除: カウンターショット

### キーボード

- 矢印キー / WASD: 移動
- Space: ショット
- Shift: スロー
- Shift を離す: カウンターショット
- P / Esc: ポーズ
- F: フルスクリーン切り替え
- Enter: リトライ / 開始

## 使用技術

- Codex (GPT 5.5): コード生成、バランス調整、テスト、README 作成
- gpt-image-2(もしくはgpt-image-1.5): ゲーム用画像アセット（自機、敵、弾、背景）の生成
- フロントエンド: TypeScript / Vite / HTML Canvas
- Playwright: テスト

## gpt-image-2 で作成した画像

以下の画像アセットを gpt-image-2 で作成し、ゲーム内で使用しています。

| 画像 | 用途 | パス |
| --- | --- | --- |
| combat-sprites.png | 自機、敵、弾をまとめたスプライトアトラス | `public/assets/generated/combat-sprites.png` |
| combat-sprites-key.png | スプライトアトラス確認用のキー画像（ゲーム内では未使用） | `public/assets/generated/combat-sprites-key.png` |
| ally-ship.png | 自機スプライト | `public/assets/generated/ally-ship.png` |
| enemy-drone.png | 敵ドローンスプライト | `public/assets/generated/enemy-drone.png` |
| bullet-projectile.png | 弾スプライト | `public/assets/generated/bullet-projectile.png` |
| prism-orchard-bg.png | 背景画像 | `public/assets/prism-orchard-bg.png` |

## ローカル実行

```bash
git clone https://github.com/miya123123/slowshot-nova.git
cd slowshot-nova
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5173/` を開きます。
