import Icon from './Icon';

export default function Help({ onClose }: { onClose: () => void }) {
  return <section className="help-panel panel" aria-label="Справка по синтаксису">
    <div className="panel-heading"><h2>Как вводить выражения</h2><button className="icon-button" aria-label="Закрыть справку" onClick={onClose}><Icon name="close" /></button></div>
    <div className="help-grid">
      <div><h3>Дроби и корни</h3><code>1/2 + 1/3</code><code>sqrt(2) · cbrt(27) · root(32,5)</code><code>mixed(2,1,3) = 2⅓</code></div>
      <div><h3>Функции</h3><code>sin(30) в DEG · sin(pi/2) в RAD</code><code>log(8,2) · ln(e)</code><code>nCr(5,2) · gcd(12,18)</code></div>
      <div><h3>Проценты и запись чисел</h3><code>500 + 20% · 20% от 500</code><code>mod(20,3) — остаток от деления</code><code>1.5e8 · 2π · 2(3+4)</code></div>
      <div><h3>Неизвестные a–z</h3><code>2x + 3x → 5x</code><code>a · a → a² · x/2 + x/3 → 5x/6</code><p className="muted small">Выберите a–z на клавиатуре. Значения задаются под выражением; пустое поле оставляет букву неизвестной. Клавиша e в a–z — неизвестная, в «Науч» — число Эйлера.</p></div>
    </div>
    <p className="muted small">Степени вычисляются справа налево: 2^3^2 = 512. Для отрицательного основания используйте скобки: (-2)^2. Вещественная арифметика; дроби вычисляются точно, приближения округляются до 10 знаков.</p>
  </section>;
}
