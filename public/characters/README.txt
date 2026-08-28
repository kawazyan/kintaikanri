キャラクターアバター画像の配置場所

スタッフはマイルーム画面で複数のキャラクターから選べます。キャラクターごとに
フォルダを分け、その中に以下の3ファイルを置いてください(ファイル名は固定):

  public/characters/<キャラクターID>/avatar-home.png  … 未出勤(自宅リビング背景)
  public/characters/<キャラクターID>/avatar-work.png  … 出勤中(携帯ショップ店内背景)
  public/characters/<キャラクターID>/avatar-night.png … 退勤済み(夜の街並み背景)

例: デフォルトキャラクターは public/characters/default/ 配下にあります。

新しいキャラクターを追加する手順:
1. public/characters/<新しいid>/ に上記3ファイルを配置
   (id は英数字とハイフンのみを推奨、例: "char-b")
2. src/lib/character-config.ts の CHARACTER_DEFINITIONS に
   { id: "<新しいid>", label: "<選択画面に表示する名前>" } を追加
3. これでマイルーム画面の選択肢に自動的に表示されます

マスター画像(4枚目)は現在どの画面でも直接表示していません。将来「仲間のタウン」
機能などで使う可能性があるため、参考として avatar-master.png という名前で
一緒に置いておいても構いません(未使用でもエラーにはなりません)。
