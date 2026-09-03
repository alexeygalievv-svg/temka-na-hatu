export function isRequisitesPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const query = window.location.search.toLowerCase();
  return (
    path.endsWith('/requisites') ||
    path.endsWith('/requisites.html') ||
    hash.includes('requisites') ||
    query.includes('page=requisites')
  );
}

export function RequisitesScreen() {
  return (
    <div className="requisites">
      <article className="requisites__card">
        <p className="requisites__eyebrow">Карта воспоминаний</p>
        <h1>Реквизиты</h1>
        <p className="requisites__lead">
          Платежи принимает самозанятый. На этой странице указан ИНН получателя оплаты.
        </p>
        <dl>
          <dt>ФИО</dt>
          <dd>Галиев Алексей Юрьевич</dd>
          <dt>Статус</dt>
          <dd>Самозанятый (налог на профессиональный доход)</dd>
          <dt>ИНН</dt>
          <dd className="requisites__inn">345947188258</dd>
          <dt>Электронная почта</dt>
          <dd>
            <a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a>
          </dd>
          <dt>Телефон</dt>
          <dd>
            <a href="tel:+79963688158">+7 996 368-81-58</a>
          </dd>
        </dl>
      </article>
    </div>
  );
}
