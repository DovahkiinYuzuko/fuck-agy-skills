# fuck-agy-skills

Agent Skills（~/.agents/skills）をGoogle Antigravity（~/.gemini/config/skills）へ物理コピーで同期するCLIツール / CLI tool that synchronizes Agent Skills (~/.agents/skills) to Google Antigravity (~/.gemini/config/skills) via physical directory copying

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.0+-000000?style=flat-square&logo=bun&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square&logo=opensourceinitiative&logoColor=white)](./LICENSE.MIT)

[日本語](#日本語) | [English](#english)

## 日本語

> [!NOTE]
> このリポジトリはエージェントスキルそのものではありません。単純な同期ツールです。

### 概要
汎用エージェントスキル規格（`~/.agents/skills/`）で管理されているスキル群を、Google Antigravityのグローバルスキル探索先（`~/.gemini/config/skills/`）へ実体フォルダとして同期するためのCLIツールです。

### 開発経緯
オープンなスキル管理規格（`npx skills add` 等）でインストールされたグローバルスキルは `~/.agents/skills/` に配置されます。しかし、現行のGoogle Antigravity環境（特にAntigravity 2.0やAntigravity IDE）ではグローバルスキルの探索先が `~/.gemini/config/skills/` に固定されており、Windows環境下ではジャンクション（シンボリックリンク）を配置してもスキャナがリンク先を追跡・認識しません。

公式環境がグローバルな `~/.agents/skills/` を標準で完全に読み込むようになれば本ツールは不要となりますが、現状の手動同期に伴う不要な手間を解消するために本ツールが作成されました。

### 特徴
- **クロスランタイムと自動昇格**: Node.jsおよびBunに対応しています。PATH上に `bun` が存在する場合はBunランタイムで再起動して実行します。
- **同期台帳による独自スキルの保護**: 同期したスキルを `.fuck-agy-cache.json` で管理します。同期先に元から存在するユーザー独自のスキルは、削除クリーンアップ（`--clean`）実行時でも削除されません。
- **設定管理コマンド**: CLIから直接 `config.toml` の確認・更新・初期化を行えます。
- **シミュレーション機能**: `--dry-run` オプションにより、実際のファイル変更を伴わずに動作確認が可能です。

### インストール方法
npm経由でグローバルインストールします。
```bash
npm install -g DovahkiinYuzuko/fuck-agy-skills
```

ソースコードから直接セットアップする場合：
```bash
git clone https://github.com/DovahkiinYuzuko/fuck-agy-skills.git
cd fuck-agy-skills
npm install
npm link
```

### コマンド一覧

| オプション / サブコマンド | 説明 | 用例 |
| :--- | :--- | :--- |
| *(指定なし)* | スキルを同期先に実体コピーします。 | `fuck-agy-skills` |
| `-d, --dry-run` | ファイル変更を伴わずにシミュレーション結果を表示します。 | `fuck-agy-skills --dry-run` |
| `--clean` | ソース側で削除されたスキルを同期先からも削除します。 | `fuck-agy-skills --clean` |
| `--no-clean` | 削除クリーンアップを無効化して実行します。 | `fuck-agy-skills --no-clean` |
| `-s, --source <path>` | 一時的に同期元ディレクトリを変更します。 | `fuck-agy-skills --source "C:/path/to/skills"` |
| `-t, --target <path>` | 一時的に同期先ディレクトリを変更します。 | `fuck-agy-skills --target "C:/path/to/target"` |
| `-e, --exclude <list>` | 一時的に除外するスキル名をカンマ区切りで指定します。 | `fuck-agy-skills --exclude "skill-a,skill-b"` |
| `-c, --config <path>` | 指定した設定ファイルを使用して実行します。 | `fuck-agy-skills --config "./my-config.toml"` |
| `config path` | 現在参照されている設定ファイルの絶対パスを表示します。 | `fuck-agy-skills config path` |
| `config get [key]` | 現在の設定値（または全体）を表示します。 | `fuck-agy-skills config get clean_deleted` |
| `config set <key> <value>` | 設定ファイルの値を更新・保存します。 | `fuck-agy-skills config set clean_deleted true` |
| `config init [path]` | デフォルト設定ファイルを新規生成します。 | `fuck-agy-skills config init` |
| `-h, --help` | ヘルプメッセージを表示します。 | `fuck-agy-skills --help` |
| `-v, --version` | バージョン情報を表示します。 | `fuck-agy-skills --version` |

### 設定管理
設定ファイル（`config.toml`）は以下の優先順位で探索されます。他プロジェクトの設定ファイルとの衝突を防ぐため、カレントディレクトリからの暗黙的な自動読み込みは行いません。
1. `--config <path>` オプション
2. ツール自身のインストールディレクトリ直下の `config.toml`

設定ファイルが存在しない場合、初回実行時にツール自身のインストールディレクトリ直下に `config.toml` が自動生成されます。

### LICENSE
[MIT](./LICENSE.MIT)

Third-Party → [NOTICE.md](./NOTICE.md)


## English

> [!NOTE]
> This repository is not an agent skill itself. It is a simple synchronization tool.

### Overview
A CLI tool designed to synchronize skills managed under universal agent specifications (`~/.agents/skills/`) to Google Antigravity's global skills directory (`~/.gemini/config/skills/`) via physical directory copying.

### Why This Exists
Global skills installed via open skill management specifications (such as `npx skills add`) are placed in `~/.agents/skills/`. However, under current Google Antigravity environments (particularly Antigravity 2.0 and Antigravity IDE), global skill discovery is restricted to `~/.gemini/config/skills/`. Furthermore, on Windows, Antigravity's scanner does not follow or recognize directory junctions or symbolic links.

While this tool will become obsolete once the official Antigravity environment fully supports global `~/.agents/skills/` natively, it was created to eliminate the unnecessary friction caused by manual synchronization.

### Features
- **Cross-Runtime & Auto-Elevation**: Supports both Node.js and Bun. If `bun` is available in your PATH, it restarts under the Bun runtime to execute.
- **Sync Ledger Protection**: Manages synced skills via `.fuck-agy-cache.json`. User-native skills residing in the target directory are strictly preserved and never deleted by `--clean`.
- **Configuration Management**: Inspect, update, or initialize `config.toml` directly from the CLI.
- **Dry-Run Simulation**: Preview planned copy and clean operations without modifying the filesystem using `--dry-run`.

### Installation
Install globally via npm:
```bash
npm install -g DovahkiinYuzuko/fuck-agy-skills
```

Or set up from source:
```bash
git clone https://github.com/DovahkiinYuzuko/fuck-agy-skills.git
cd fuck-agy-skills
npm install
npm link
```

### Commands

| Option / Subcommand | Description | Example |
| :--- | :--- | :--- |
| *(None)* | Synchronizes skills to target directory via physical copying. | `fuck-agy-skills` |
| `-d, --dry-run` | Simulates synchronization without modifying files. | `fuck-agy-skills --dry-run` |
| `--clean` | Deletes skills from target that were removed from source (ledger-tracked only). | `fuck-agy-skills --clean` |
| `--no-clean` | Disables deletion cleanup for the current run. | `fuck-agy-skills --no-clean` |
| `-s, --source <path>` | Temporarily overrides the source directory. | `fuck-agy-skills --source "C:/path/to/skills"` |
| `-t, --target <path>` | Temporarily overrides the target directory. | `fuck-agy-skills --target "C:/path/to/target"` |
| `-e, --exclude <list>` | Specifies a comma-separated list of skills to exclude. | `fuck-agy-skills --exclude "skill-a,skill-b"` |
| `-c, --config <path>` | Executes using a custom configuration file. | `fuck-agy-skills --config "./my-config.toml"` |
| `config path` | Displays the absolute path of the active configuration file. | `fuck-agy-skills config path` |
| `config get [key]` | Displays configuration values (or all settings if key is omitted). | `fuck-agy-skills config get clean_deleted` |
| `config set <key> <value>` | Updates and persists a setting in `config.toml`. | `fuck-agy-skills config set clean_deleted true` |
| `config init [path]` | Generates a new default configuration file. | `fuck-agy-skills config init` |
| `-h, --help` | Displays help message. | `fuck-agy-skills --help` |
| `-v, --version` | Displays version information. | `fuck-agy-skills --version` |

### Configuration Management
Configuration files (`config.toml`) are resolved using the following priority. To prevent collisions with other projects, automatic implicit lookup from the current working directory is disabled:
1. `--config <path>` option
2. Package installation directory

If no configuration file exists, `config.toml` is created automatically in the package installation directory on initial run.

### LICENSE
[MIT](./LICENSE.MIT)

Third-Party → [NOTICE.md](./NOTICE.md)
