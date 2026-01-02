import unittest
import sys
import time

# テスト実行時にビルドされたモジュールをインポートできるようにする
try:
    import context_graph_rs
except ImportError:
    print("\033[91m[CRITICAL] context_graph_rs module not found.\033[0m")
    print("Please run 'maturin develop --features python' first.")
    sys.exit(1)


class TestContextEngineSystematic(unittest.TestCase):
    """
    ContextGraph-RSの包括的・体系的テストスイート

    検証範囲:
    1. Basic I/O: 入出力の整合性、初期化
    2. Physical Context: 物理的動作（把持、ドラッグ、手洗い、隠蔽）の推論
    3. Semantic Context: 意味的ジェスチャー（ジャンケン、Yes/No）の推論
    4. Cultural/Emotional: 三猿、感情推定
    5. Dynamics: 時間的減衰(Decay)、競合抑制(Inhibition)、飽和(Saturation)
    """

    def setUp(self):
        """各テスト前にエンジンをクリーンな状態で初期化"""
        self.engine = context_graph_rs.ContextEngine()
        self.step_count = 0

    def _inject_and_step(self, sensors, steps=10):
        """指定したセンサー値を注入し、指定回数ステップを進めるヘルパー"""
        for _ in range(steps):
            self.engine.inject(sensors)
            self.engine.step()
            self.step_count += 1

    def _get_value(self, node_id):
        """特定のノードの活性化値を取得"""
        return self.engine.get_activations().get(node_id, 0.0)

    def _assert_dominant(self, expected_state_id, threshold=0.5):
        """
        指定したステートが最も活性化しており、かつ閾値を超えていることを検証
        """
        ranked = self.engine.get_ranked_states()
        if not ranked:
            self.fail("No states returned from engine.")

        top = ranked[0]
        # 失敗時のデバッグ情報作成
        debug_msg = f"\nExpected Top: {expected_state_id}\nActual Top:   {top['id']} (Val: {top['value']:.3f})"
        debug_msg += "\nTop 3 States:"
        for s in ranked[:3]:
            debug_msg += f"\n - {s['id']}: {s['value']:.3f}"

        self.assertEqual(top["id"], expected_state_id, debug_msg)
        self.assertGreater(
            top["value"],
            threshold,
            f"{expected_state_id} value too low: {top['value']:.3f}",
        )

    # =========================================================================
    # 1. 物理的コンテキスト (Physical Logic)
    # =========================================================================

    def test_phys_grasp_vs_drag(self):
        """
        [物理] GRASP(把持) と DRAG(引きずり) の判別テスト
        """
        print(f"\n[{self._testMethodName}] Testing Grasp vs Drag differentiation...")

        # Case 1: 静止状態で握る -> GRASP
        self._inject_and_step({"IN_FIST": 1.0, "IN_VEL": 0.0}, steps=15)
        self._assert_dominant("ST_GRASP", 0.8)
        print("  ✓ Static Fist triggers ST_GRASP")

        # リセット
        self.setUp()

        # Case 2: 動きながら握る -> DRAG
        self._inject_and_step({"IN_FIST": 1.0, "IN_VEL": 1.0}, steps=15)

        val_grasp = self._get_value("ST_GRASP")
        val_drag = self._get_value("ST_DRAG")

        print(f"  > With Velocity: GRASP={val_grasp:.3f}, DRAG={val_drag:.3f}")
        self._assert_dominant("ST_DRAG", 0.8)
        self.assertGreater(
            val_drag, val_grasp, "Drag should be higher than Grasp when moving"
        )
        print("  ✓ Moving Fist triggers ST_DRAG")

    def test_phys_washing(self):
        """
        [物理] 手洗い動作 (WASH) のテスト
        """
        print(f"\n[{self._testMethodName}] Testing Hand Washing detection...")

        inputs = {"IN_HANDS_PROX": 1.0, "IN_REL_MOV": 1.0}
        self._inject_and_step(inputs, steps=15)

        self._assert_dominant("ST_WASH")

        # 競合チェック: 手洗いはGRASPやDRAGを抑制するはず
        val_grasp = self._get_value("ST_GRASP")
        self.assertLess(val_grasp, 0.2, "Washing should inhibit Grasping")
        print(
            f"  ✓ Washing detected (Value: {self._get_value('ST_WASH'):.3f}) and inhibits Grasp"
        )

    def test_phys_peekaboo(self):
        """
        [物理] いないいないばあ (PEEKABOO/HIDDEN) のテスト
        """
        print(f"\n[{self._testMethodName}] Testing Object Permanence (Peekaboo)...")

        self._inject_and_step({"IN_OCCLUSION": 1.0}, steps=10)
        self._assert_dominant("ST_PEEKABOO")
        print(f"  ✓ Occlusion correctly triggers ST_PEEKABOO")

    # =========================================================================
    # 2. 意味的コンテキスト (Semantic Logic)
    # =========================================================================

    def test_sem_rps_logic(self):
        """
        [意味] じゃんけん (Rock, Paper, Scissors) のテスト
        注意: 'IN_FIST' は物理的な 'ST_GRASP' も強く活性化させるため、
        'ST_ROCK' が全体1位とは限らない。
        ここでは 'ST_ROCK' が他のじゃんけんの手より優位であることを確認する。
        """
        print(
            f"\n[{self._testMethodName}] Testing Rock-Paper-Scissors mutual exclusion..."
        )

        # 1. Rock
        self.setUp()
        self._inject_and_step({"IN_FIST": 1.0}, steps=10)
        val_rock = self._get_value("ST_ROCK")
        val_paper = self._get_value("ST_PAPER")
        val_scissors = self._get_value("ST_SCISSORS")

        print(f"  > Rock Input: ROCK={val_rock:.3f}, PAPER={val_paper:.3f}")
        self.assertGreater(val_rock, 0.8, "Rock should be active")
        self.assertGreater(val_rock, val_paper, "Rock should beat Paper")
        self.assertGreater(val_rock, val_scissors, "Rock should beat Scissors")

        # 2. Paper (Open Hand)
        self.setUp()
        self._inject_and_step({"IN_OPEN": 1.0}, steps=10)
        self._assert_dominant("ST_PAPER")

        # 3. Scissors
        self.setUp()
        self._inject_and_step({"IN_SCISSORS": 1.0}, steps=10)
        self._assert_dominant("ST_SCISSORS")

        print("  ✓ RPS logic verified")

    def test_sem_yes_no_conflict(self):
        """
        [意味] YES / NO の強い相互抑制 (Winner-Take-All) テスト
        - 先に活性化した方が支配権を握り、後から来た対立入力を抑制することを確認
        """
        print(f"\n[{self._testMethodName}] Testing YES/NO Winner-Take-All...")

        # 1. YESを確立させる
        self._inject_and_step({"IN_THUMB_UP": 1.0}, steps=10)
        val_yes_initial = self._get_value("ST_YES")
        print(f"  > Initial YES: {val_yes_initial:.3f}")
        self.assertGreater(val_yes_initial, 0.9)

        # 2. CONFLICT注入 (NOの入力も入れる)
        print("  > Injecting CONFLICT (Thumb UP + DOWN)...")
        self._inject_and_step({"IN_THUMB_UP": 1.0, "IN_THUMB_DOWN": 1.0}, steps=10)

        val_yes_conflict = self._get_value("ST_YES")
        val_no_conflict = self._get_value("ST_NO")

        print(
            f"  > Conflict State: YES={val_yes_conflict:.3f}, NO={val_no_conflict:.3f}"
        )

        # 検証: Winner-Take-Allが機能しているか？
        # YESは既に支配的なので、NO（後発）からの抑制を受けず高いままのはず
        self.assertGreater(
            val_yes_conflict, 0.9, "YES should maintain dominance (Winner-Take-All)"
        )

        # NOは入力がある(IN_THUMB_DOWN=1.0)にも関わらず、YESからの抑制(-2.0)で0に抑え込まれるはず
        self.assertLess(
            val_no_conflict, 0.1, "NO should be completely suppressed by YES"
        )

        print("  ✓ Winner-Take-All inhibition confirmed (YES suppressed NO)")

    # =========================================================================
    # 3. 三猿と感情 (Cultural/Emotional)
    # =========================================================================

    def test_cult_three_wise_monkeys(self):
        """[文化] 三猿 (見ざる、言わざる、聞かざる) のテスト"""
        print(f"\n[{self._testMethodName}] Testing Three Wise Monkeys...")

        # Mizaru
        self.setUp()
        self._inject_and_step({"IN_EYES_ACT": 1.0}, steps=10)
        self._assert_dominant("ST_MIZARU")
        print("  ✓ MIZARU detected")

        # Kikazaru
        self.setUp()
        self._inject_and_step({"IN_EARS_ACT": 1.0}, steps=10)
        self._assert_dominant("ST_KIKAZARU")
        print("  ✓ KIKAZARU detected")

        # Iwazaru
        self.setUp()
        self._inject_and_step({"IN_MOUTH_GUARD": 1.0}, steps=10)
        self._assert_dominant("ST_IWAZARU")
        print("  ✓ IWAZARU detected")

    def test_emo_surprise(self):
        """[感情] 驚き (Surprise) のテスト"""
        print(f"\n[{self._testMethodName}] Testing Emotional Surprise...")

        inputs = {"IN_MOUTH": 1.0, "IN_FACE_PROX": 1.0}
        self._inject_and_step(inputs, steps=10)

        self._assert_dominant("ST_SURPRISE")
        self.assertGreater(self._get_value("FT_SHOCK"), 0.5)
        print("  ✓ Surprise detected")

    # =========================================================================
    # 4. ダイナミクス (Dynamics: Decay & Propagation)
    # =========================================================================

    def test_dynamics_propagation_delay(self):
        """[時間] 活性化の伝播遅延テスト"""
        print(f"\n[{self._testMethodName}] Testing Propagation Delay...")

        # Step 1: まだ反応なし
        self.engine.inject({"IN_FIST": 1.0})
        self.engine.step()
        val_ft = self._get_value("FT_HOLDING")
        val_st = self._get_value("ST_GRASP")
        print(f"  Step 1: Feature={val_ft:.3f}, State={val_st:.3f}")

        self.assertGreater(val_ft, val_st, "Feature should activate before State")

        # Step 5: 伝播完了
        self._inject_and_step({"IN_FIST": 1.0}, steps=4)
        val_st_final = self._get_value("ST_GRASP")
        print(f"  Step 5: State={val_st_final:.3f}")

        self.assertGreater(val_st_final, 0.8, "State should be high after propagation")
        print("  ✓ Correct propagation order confirmed")

    def test_dynamics_decay(self):
        """
        [時間] 減衰 (Decay) のテスト
        """
        print(f"\n[{self._testMethodName}] Testing Activation Decay...")

        # 活性化
        self._inject_and_step({"IN_THUMB_UP": 1.0}, steps=10)
        peak_value = self._get_value("ST_YES")
        print(f"  Peak Value: {peak_value:.3f}")
        self.assertGreater(peak_value, 0.9)

        # 入力停止
        print("  > Stopping Input...")
        self._inject_and_step({"IN_THUMB_UP": 0.0}, steps=10)

        decayed_value = self._get_value("ST_YES")
        print(f"  Decayed Value (10 steps later): {decayed_value:.3f}")

        # シグモイドのブースト効果があるため、完全な0にはならないが、ピークよりは確実に下がる
        self.assertLess(
            decayed_value, peak_value * 0.8, "Value must decay significantly"
        )
        print("  ✓ Decay logic functional")

    def test_dynamics_stability(self):
        """[安定性] 長時間実行時の安定性"""
        print(f"\n[{self._testMethodName}] Testing Long-term Stability...")

        import random

        for _ in range(1000):
            inputs = {"IN_VEL": random.random(), "IN_FIST": random.random()}
            self.engine.inject(inputs)
            self.engine.step()

        acts = self.engine.get_activations()
        for k, v in acts.items():
            if not (0.0 <= v <= 1.0):
                self.fail(f"Node {k} value out of bounds [0, 1]: {v}")

        print("  ✓ 1000 steps simulation stable")


if __name__ == "__main__":
    unittest.main(verbosity=1)
