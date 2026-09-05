import { APP_URL, LEGAL_DOCS_TERMS_URL, LEGAL_DOCS_URL } from '../lib/legal';

export function LegalScreen() {
  return (
    <div className="legal">
      <nav className="legal__nav" aria-label="Разделы">
        <a href="#legal-main">Главная</a>
        <a href="#legal-pay">Оплата</a>
        <a href="#legal-delivery">Получение</a>
        <a href="#legal-terms">Оферта</a>
        <a href="#legal-requisites">Реквизиты</a>
        <a href="#legal-contacts">Контакты</a>
      </nav>

      <section id="legal-main" className="legal__card">
        <p className="legal__eyebrow">Онлайн-сервис</p>
        <h1>Карта воспоминаний</h1>
        <p className="legal__lead">
          Сервис для создания подарочной интерактивной карты мест: вы отмечаете точки с фото и
          историями, а близкий человек открывает ссылку и проходит по ним в анимированном туре.
        </p>
        <div className="legal__box">
          <h2>Услуга</h2>
          <h3>Публикация карты воспоминаний</h3>
          <p>
            Создание и публикация персональной карты в Telegram Mini App с уникальной ссылкой для
            получателя. Цифровая услуга, результат предоставляется в электронном виде сразу после
            оплаты.
          </p>
          <p className="legal__price">199 ₽ за одну карту</p>
        </div>
        <p>
          <a className="legal__btn" href="#legal-pay">
            Оплатить 199 ₽
          </a>
        </p>
      </section>

      <section id="legal-pay" className="legal__card">
        <p className="legal__eyebrow">Оплата на сайте</p>
        <h2>Оплатить услугу</h2>
        <p className="legal__lead">
          Оплата через ЮKassa: банковская карта (Visa, Mastercard, МИР) или СБП. Сумма списывается в
          рублях.
        </p>
        <div className="legal__box">
          <p>Услуга: публикация карты воспоминаний</p>
          <p className="legal__price">К оплате: 199,00 ₽</p>
        </div>
        <form
          className="legal__pay-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            form.hidden = true;
            const ok = form.parentElement?.querySelector('.legal__pay-ok');
            if (ok) ok.removeAttribute('hidden');
          }}
        >
          <label>
            Электронная почта для чека
            <input type="email" name="email" required placeholder="name@example.com" autoComplete="email" />
          </label>
          <label className="legal__agree">
            <input type="checkbox" name="offer" required />
            <span>
              Согласен с офертой и принимаю оплату 199 ₽ за публикацию одной карты.
            </span>
          </label>
          <button className="legal__btn" type="submit">
            Оплатить 199 ₽ картой или СБП
          </button>
        </form>
        <p className="legal__pay-ok" hidden>
          Заявка на оплату 199 ₽ принята. Платёж обрабатывается через ЮKassa банковской картой или
          СБП. После подтверждения оплаты карта публикуется в Telegram Mini App.
        </p>
      </section>

      <section id="legal-delivery" className="legal__card">
        <p className="legal__eyebrow">Цифровая услуга</p>
        <h2>Получение заказа</h2>
        <p className="legal__lead">Услуга оказывается в электронном виде. Физическая доставка не предусмотрена.</p>
        <ol>
          <li>После успешной оплаты в Telegram Mini App карта публикуется автоматически.</li>
          <li>На экране сразу отображается персональная ссылка для получателя.</li>
          <li>Вы копируете ссылку и отправляете её получателю в мессенджер.</li>
          <li>Получатель открывает ссылку в Telegram и просматривает карту.</li>
        </ol>
        <p>
          Ссылка предоставляется сразу после подтверждения оплаты. Если ссылка не появилась, напишите
          на <a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a> или
          позвоните <a href="tel:+79963688158">+7 996 368-81-58</a>.
        </p>
      </section>

      <section id="legal-terms" className="legal__card">
        <p className="legal__eyebrow">Правовая информация</p>
        <h2>Пользовательское соглашение и публичная оферта</h2>
        <p className="legal__lead">
          Настоящий документ регулирует условия использования онлайн-сервиса «Карта воспоминаний» и
          является публичной офертой в соответствии со ст. 437 Гражданского кодекса РФ.
        </p>
        <h3>1. Термины</h3>
        <p>
          Сервис — Telegram Mini App «Карта воспоминаний» и сайт{' '}
          <a href={APP_URL}>{APP_URL}</a>. Правовые документы также опубликованы на{' '}
          <a href={LEGAL_DOCS_URL}>{LEGAL_DOCS_URL}</a>. Исполнитель — Галиев Алексей Юрьевич,
          самозанятый, ИНН 345947188258. Пользователь / Заказчик — лицо, использующее Сервис. Карта
          — созданный Пользователем набор точек, фото и текстов.
        </p>
        <h3>2. Предмет</h3>
        <p>
          Исполнитель предоставляет доступ к Сервису для создания карты и, после оплаты, публикует
          карту и выдаёт персональную ссылку для просмотра получателем.
        </p>
        <h3>3. Стоимость и оплата</h3>
        <p>
          Стоимость публикации одной карты — <strong>199 (сто девяносто девять) рублей</strong>.
          Оплата производится через платёжный сервис ЮKassa банковской картой или через СБП. Цена
          указана на сайте и действует на момент оплаты.
        </p>
        <h3>4. Порядок оказания услуги</h3>
        <ol>
          <li>Пользователь создаёт карту в Telegram Mini App.</li>
          <li>Пользователь оплачивает публикацию.</li>
          <li>После подтверждения оплаты Пользователю предоставляется ссылка на опубликованную карту.</li>
        </ol>
        <p>Подробности — в разделе «Получение заказа».</p>
        <h3>5. Момент оказания услуги</h3>
        <p>
          Услуга считается оказанной с момента предоставления Пользователю рабочей ссылки на
          опубликованную карту.
        </p>
        <h3>6. Условия использования Сервиса</h3>
        <ul>
          <li>Пользователь размещает только законный контент, на который имеет права.</li>
          <li>Запрещены оскорбительные, незаконные и чужие материалы без разрешения правообладателя.</li>
          <li>Пользователь несёт ответственность за содержание загруженных фото и текстов.</li>
          <li>Исполнитель вправе удалить карту при нарушении закона или настоящего соглашения.</li>
        </ul>
        <h3>7. Персональные данные</h3>
        <p>
          Для работы Сервиса обрабатываются данные Telegram-профиля (имя, идентификатор), загруженные
          фото, тексты и координаты точек. Данные хранятся на сервере Исполнителя для предоставления
          услуги. По вопросам обработки данных обращайтесь:{' '}
          <a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a>.
        </p>
        <h3>8. Возврат средств</h3>
        <p>
          Услуга цифровая и оказывается сразу после оплаты. Возврат возможен, если услуга не была
          оказана по вине Исполнителя (ссылка не предоставлена). Обращение — на{' '}
          <a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a> в течение
          7 дней с указанием даты и суммы оплаты.
        </p>
        <h3>9. Ограничение ответственности</h3>
        <p>
          Сервис предоставляется «как есть». Исполнитель не отвечает за перебои связи, работу
          Telegram, платёжных систем и действий третьих лиц, но стремится обеспечить доступность
          опубликованных карт.
        </p>
        <h3>10. Изменение условий</h3>
        <p>
          Исполнитель вправе обновлять настоящее соглашение, публикуя новую редакцию на этой странице.
          Актуальная версия всегда доступна по адресу{' '}
          <a href={LEGAL_DOCS_TERMS_URL}>{LEGAL_DOCS_TERMS_URL}</a>.
        </p>
        <h3>11. Контакты и претензии</h3>
        <p>
          Галиев Алексей Юрьевич,{' '}
          <a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a>,{' '}
          <a href="tel:+79963688158">+7 996 368-81-58</a>.
        </p>
        <h3>12. Акцепт оферты</h3>
        <p>
          Оплата услуги и/или использование Сервиса означает полное и безоговорочное принятие
          условий настоящего пользовательского соглашения и публичной оферты.
        </p>
        <p className="legal__muted">Дата публикации: 3 сентября 2026 г.</p>
      </section>

      <section id="legal-requisites" className="legal__card">
        <p className="legal__eyebrow">Платежи</p>
        <h2>Реквизиты</h2>
        <p className="legal__lead">Платежи принимает самозанятый. На странице указан ИНН получателя оплаты.</p>
        <dl>
          <dt>ФИО</dt>
          <dd>Галиев Алексей Юрьевич</dd>
          <dt>Статус</dt>
          <dd>Самозанятый (налог на профессиональный доход)</dd>
          <dt>ИНН</dt>
          <dd className="legal__inn">345947188258</dd>
          <dt>Электронная почта</dt>
          <dd><a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a></dd>
          <dt>Телефон</dt>
          <dd><a href="tel:+79963688158">+7 996 368-81-58</a></dd>
        </dl>
      </section>

      <section id="legal-contacts" className="legal__card">
        <p className="legal__eyebrow">Связь</p>
        <h2>Контакты</h2>
        <dl>
          <dt>Исполнитель</dt>
          <dd>Галиев Алексей Юрьевич</dd>
          <dt>Электронная почта</dt>
          <dd><a href="mailto:galievalexeygaliev@yandex.com">galievalexeygaliev@yandex.com</a></dd>
          <dt>Телефон</dt>
          <dd><a href="tel:+79963688158">+7 996 368-81-58</a></dd>
          <dt>Telegram</dt>
          <dd><a href="https://t.me/foryougift67Bot">@foryougift67Bot</a></dd>
        </dl>
      </section>
    </div>
  );
}
