# プロジェクト構造

## ルート

- `project.godot`  
  Godot プロジェクト設定。メインシーンは `res://scenes/main.tscn`。

- `README.md`  
  実行方法、操作、主要ドキュメントへの入口。

- `.gitignore`  
  Godot のローカルキャッシュや一時ファイルを除外。

- `.github/workflows/pages.yml`  
  `web/` をGitHub PagesへデプロイするActionsワークフロー。

## `scenes/`

- `scenes/main.tscn`  
  現在の起動シーン。実体は `scripts/main.gd` がランタイムで構築します。

現段階では、プレイヤーや感染ノードは個別シーンではなくコード生成にしています。プロトタイプ速度を優先し、挙動が固まってから `scenes/entities/` へ分割する方針です。

## `scripts/`

- `scripts/main.gd`  
  マッチ起動、リセット、プレイヤー生成、感染ノード登録、汚染解決を担当。

- `scripts/systems/arena_grid.gd`  
  セクター生成、セル状態、一時ファイアウォール、データストリーム、ゲート、伝播用隣接セルを担当。

- `scripts/systems/propagation_resolver.gd`  
  感染ノードからのグラフ伝播、遅延解決、パケット風VFXを担当。

- `scripts/entities/player_ai.gd`  
  プレイヤー移動、設置アクション、インテグリティ、簡易ボットを担当。

- `scripts/entities/infection_node.gd`  
  感染ノードのアーム、連鎖起動、起爆を担当。

- `scripts/ui/hud.gd`  
  プレイヤー状態、クールダウン、セクター情報のHUDを担当。

## `docs/`

企画、ビジュアル、ロードマップ、UI、マルチプレイヤー方針を日本語で管理します。ゲームの方向性を変える場合は、まず `docs/vision.md` と `docs/prototype_roadmap.md` を更新します。

## `assets/`

現在はコード描画の仮ビジュアルです。AI生成画像を参照にする場合も、最終ゲーム用には描き直したトップダウンアセットだけを追加します。

## `web/`

GitHub Pagesでそのまま遊べるHTML5 Canvas版です。

- `web/index.html`  
  Pagesの入口。

- `web/styles.css`  
  全画面Canvas用の最小スタイル。

- `web/game.js`  
  ブラウザ版のゲームループ、アリーナ生成、プレイヤー、感染ノード、伝播、HUD。

- `web/.nojekyll`  
  GitHub Pagesで静的ファイルをそのまま配信するための設定。
