import unittest
import sys
import os

# テスト実行時にビルドされたモジュールをインポートできるようにする
# maturin develop でインストール済みであれば不要だが、念のため
try:
    import context_graph_rs
except ImportError:
    print("Error: context_graph_rs module not found.")
    print("Please run 'maturin develop --features python' first.")
    sys.exit(1)


class TestContextEngine(unittest.TestCase):
    def setUp(self):
        """テストごとにエンジンを初期化"""
        self.engine = context_graph_rs.ContextEngine()
        print("\n[Setup] Engine Initialized")

    def test_initial_state(self):
        """初期状態ですべてのノードが0（または低値）であることを確認"""
        activations = self.engine.get_activations()
        # 適当なノードをチェック
        self.assertLess(activations.get("ST_IDLE", 0.0), 0.1)
        self.assertLess(activations.get("ST_GRASP", 0.0), 0.1)
        print("[Pass] Initial state check")

    def test_grasp_logic(self):
        """
        ダミー入力: 強く握っている状態 (FIST=1.0)
        期待される挙動: FT_HOLDING が上がり、ST_GRASP が活性化する
        """
        # 1. センサー入力 (Fistを検知)
        sensors = {
            "IN_FIST": 1.0,
            "IN_VEL": 0.1,  # 少し動きがある
            "IN_OPEN": 0.0,
        }

        print(f"[Input] Injecting sensors: {sensors}")

        # 2. 数ステップ実行して拡散させる
        for i in range(5):
            self.engine.inject(sensors)
            self.engine.step()

            # 途中経過のログ
            acts = self.engine.get_activations()
            print(
                f"  Step {i + 1}: FT_HOLDING={acts.get('FT_HOLDING'):.3f}, ST_GRASP={acts.get('ST_GRASP'):.3f}"
            )

        # 3. 検証
        ranked = self.engine.get_ranked_states()
        top_state = ranked[0]

        print(
            f"[Result] Top State: {top_state['label']} (Value: {top_state['value']:.3f})"
        )

        # 期待: ST_GRASP が上位に来ていること
        # (ロジック上、IN_FIST -> FT_HOLDING -> ST_GRASP と伝播する)
        self.assertEqual(top_state["id"], "ST_GRASP")
        self.assertGreater(top_state["value"], 0.5)  # 0.5以上の確信度

    def test_inhibition(self):
        """
        抑制のテスト:
        ST_YES と ST_NO は相互抑制の関係にある。
        ST_YES を活性化させると、ST_NO は下がりにくくなる（あるいは下がる）はず。
        """
        # YESを活性化させる入力 (Thumb Up)
        sensors_yes = {"IN_THUMB_UP": 1.0}

        print("[Input] Injecting Thumb Up (Expect YES)")
        for _ in range(5):
            self.engine.inject(sensors_yes)
            self.engine.step()

        acts_yes = self.engine.get_activations()
        val_yes = acts_yes.get("ST_YES", 0.0)
        val_no = acts_yes.get("ST_NO", 0.0)

        print(f"  Result: YES={val_yes:.3f}, NO={val_no:.3f}")

        self.assertGreater(val_yes, val_no)
        self.assertGreater(val_yes, 0.5)


if __name__ == "__main__":
    unittest.main()
