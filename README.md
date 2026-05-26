# GridHack

GridHack は、崩壊中のメガコーポ・ネットワーク内部で侵入AI同士が戦う Godot 4 プロトタイプです。遅延型のエリア制圧、読み合い、連鎖反応の緊張感を核にしつつ、中心メカニクスは「爆発」ではなく、感染ノードがネットワーク経路を伝播するサイバー戦闘として再解釈しています。

## 現在のプレイ可能範囲

- 角張った侵入AIアバターのローカル操作。
- 遅延後にネットワーク伝播する感染ノード。
- 感染ノード設置中の薄い伝播プレビュー。
- 感染ノード同士の連鎖起動。
- 一時ファイアウォールによる戦術的な経路封鎖。
- 中央アップリンクを制圧する勝利条件。
- ハードファイアウォール、破壊可能ファイアウォール、不安定セクター、データストリーム、転送ゲートを含むプロシージャルなサイバーアリーナ。
- 初期の圧力テスト用の簡易敵AI。
- 最終アート前に調整しやすい、コード描画のネオン仮ビジュアル。

## 操作

- 移動: `WASD` または矢印キー
- 感染ノード設置: `Space`
- 一時ファイアウォール生成: `Shift`
- セクター再生成: `R`

スマホ/タブレット:

- 左下の仮想スティック: 移動
- 右下 `NODE`: 感染ノード設置
- 右下 `WALL`: 一時ファイアウォール生成
- 右上 `RESET`: セクター再生成

## 実行方法

Godot 4.3 以降でこのフォルダを開き、`res://scenes/main.tscn` を実行してください。

Godot が PATH にある場合:

```powershell
godot --path .
```

## GitHub Pagesで遊ぶ

このリポジトリには、GitHub Pages用の静的HTML5 Canvas版も入っています。

- ローカル確認: `web/index.html` をブラウザで開く
- GitHub Pages配信対象: `web/`
- 自動デプロイ: `.github/workflows/pages.yml`

公開手順:

1. このリポジトリをGitHubへpushする。
2. GitHubのリポジトリ設定で `Settings > Pages` を開く。
3. `Build and deployment` のSourceを `GitHub Actions` にする。
4. `main` または `master` ブランチへpushすると、`web/` がPagesへデプロイされる。

通常のプロジェクトページURLは `https://<ユーザー名>.github.io/<リポジトリ名>/` です。リポジトリ名が `<ユーザー名>.github.io` の場合は `https://<ユーザー名>.github.io/` になります。

## 設計ドキュメント

- [ビジョン](docs/vision.md)
- [プロジェクト構造](docs/project_structure.md)
- [ゲームプレイ・アーキテクチャ](docs/gameplay_architecture.md)
- [プロトタイプ・ロードマップ](docs/prototype_roadmap.md)
- [ビジュアル方向性](docs/visual_direction.md)
- [AIアート生成プロンプト](docs/art_generation_prompts.md)
- [UIスタイルガイド](docs/ui_style_guide.md)
- [マルチプレイヤー構成案](docs/multiplayer_architecture_proposal.md)
- [プレイテストログ](docs/playtest_log.md)

## 現在の検証目標

グラフ状の感染伝播が、古典的な爆弾グリッドゲームに見えず、読みやすい圧力・予測・連鎖反応を生むかを検証します。
