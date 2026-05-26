# Slowshot Nova

Slowshot Nova は、スワイプ中だけ時間を遅くできるブラウザ向け弾幕サバイバルゲームです。

公開URL: https://miya123123.github.io/slowshot-nova/

## ゲーム概要

プレイヤーは画面下部の自機を操作し、上空から出現する敵と敵弾を避けながら 20 秒間の生存を目指します。

スワイプまたは Shift キーを押している間は時間がスローになり、敵や敵弾の動きが遅くなります。スロー中に位置を調整し、指やキーを離した瞬間にカウンターショットで反撃します。

## ルール

- 20 秒間生き残るとクリアです。
- 敵本体または敵弾に 1 回でも当たるとゲームオーバーです。
- スロー使用可能時間には残量があります。
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

- Codex(GPT 5.5): コード生成、バランス調整、テスト、README作成
- gpt-image-2: ゲーム用画像アセットの生成
- フロントエンド: TypeScript/Vite/HTML Canvas
- Playwright: テスト

## gpt-image-2 で作成した画像

以下の画像アセットを gpt-image-2 で作成し、ゲーム内スプライトとして使用しています。

| 画像 | 用途 | パス |
| --- | --- | --- |
| combat-sprites.png | 自機、敵、弾をまとめたスプライトアトラス | `assets/generated/combat-sprites.png` |
| combat-sprites-key.png | スプライトアトラス確認用キー画像（ゲーム内では未使用） | `assets/generated/combat-sprites-key.png` |
| ally-ship.png | 自機スプライト | `assets/generated/ally-ship.png` |
| enemy-drone.png | 敵ドローンスプライト | `assets/generated/enemy-drone.png` |
| bullet-projectile.png | 弾スプライト | `assets/generated/bullet-projectile.png` |

## ローカル実行

```bash
git clone https://github.com/miya123123/slowshot-nova.git
cd slowshot-nova
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5173/` を開きます。
