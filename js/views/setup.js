// 初期設定：ようこそ → なりたい姿 → カテゴリのチェック → やりたいことの登録へ
import { h, toast } from '../ui.js';
import { loadCategories, saveGoal, markSetupDone } from '../data.js';
import { categoryPicker } from '../editors.js';

export const title = 'はじめに';

// 入力途中の内容（画面を描き直しても消えないように）
const state = { step: 'welcome', goals: [''], picks: [] };

function stepDots(n) {
  return h('div', { class: 'step-dots', 'aria-label': `3ステップ中${n}` },
    [1, 2, 3].map((i) => h('span', { class: i <= n ? 'on' : '' })));
}

export async function render(root, { rerender, navigate }) {
  const go = (step) => { state.step = step; rerender(); window.scrollTo(0, 0); };

  if (state.step === 'welcome') {
    root.append(h('section', { class: 'card welcome' },
      h('div', { class: 'welcome-emoji', 'aria-hidden': 'true' }, '🌱'),
      h('h2', {}, '育休中意識高めよう委員会へ', h('br'), 'ようこそ'),
      h('p', {}, '自分で作った「やりたいことリスト」から、毎日のおすすめを出します。'),
      h('p', {}, '毎日すこしずつ、なりたい自分に近づいていきましょう。'),
      h('button', { type: 'button', class: 'btn btn-block', onclick: () => go('goals') }, 'はじめる'),
    ));
    return;
  }

  if (state.step === 'goals') {
    const inputs = state.goals.map((text, i) => {
      const input = h('input', {
        type: 'text', class: 'input', value: text, enterkeyhint: 'next',
        placeholder: ['例：お金の知識がある人', '例：英語で話せる人', '例：心に余裕のあるママ・パパ'][i % 3],
        oninput: (e) => { state.goals[i] = e.target.value; },
      });
      return h('div', { class: 'goal-input' }, input,
        state.goals.length > 1
          ? h('button', {
            type: 'button', class: 'icon-btn', 'aria-label': '消す',
            onclick: () => { state.goals.splice(i, 1); rerender(); },
          }, '×')
          : null);
    });
    root.append(stepDots(1), h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, 'なりたい姿を教えてください'),
      h('p', { class: 'muted' }, '育休が終わるころ、どんな自分になっていたいですか？いくつでも大丈夫です。あとから変えられます。'),
      h('div', { class: 'form' }, inputs),
      h('button', {
        type: 'button', class: 'btn btn-small btn-ghost add-more',
        onclick: () => {
          state.goals.push('');
          rerender().then(() => {
            const all = document.querySelectorAll('.goal-input input');
            all[all.length - 1] && all[all.length - 1].focus();
          });
        },
      }, '＋ もうひとつ'),
    ),
    h('div', { class: 'btn-col' },
      h('button', {
        type: 'button', class: 'btn btn-block',
        onclick: () => {
          const filled = state.goals.map((t) => t.trim()).filter(Boolean);
          if (!filled.length) { toast('1つ入れるか、「あとで設定する」を選んでください'); return; }
          state.goals = filled;
          go('cats');
        },
      }, '次へ'),
      h('button', {
        type: 'button', class: 'btn btn-block btn-ghost',
        onclick: async () => { await markSetupDone(); go('done'); },
      }, 'あとで設定する'),
    ));
    return;
  }

  if (state.step === 'cats') {
    const categories = await loadCategories();
    const goals = state.goals;
    const pickers = [];
    const refreshAll = () => pickers.forEach((p) => p.refresh());
    goals.forEach((text, i) => {
      pickers.push(categoryPicker(categories, state.picks[i] || [], { onCreated: refreshAll }));
    });
    root.append(stepDots(2),
      h('p', { class: 'lead' }, 'それぞれのなりたい姿に関係するカテゴリを選んでください。選んだカテゴリのやりたいことが、おすすめに出やすくなります。'),
      ...goals.map((text, i) => h('section', { class: 'card' },
        h('h2', { class: 'card-title' }, `🌟 ${text}`),
        pickers[i].el)),
      h('div', { class: 'btn-col' },
        h('button', {
          type: 'button', class: 'btn btn-block',
          onclick: async () => {
            try {
              for (let i = 0; i < goals.length; i++) {
                await saveGoal({ text: goals[i], categoryIds: pickers[i].value });
              }
              await markSetupDone();
              state.goals = [''];
              state.picks = [];
              go('done');
            } catch (err) {
              toast(err.message);
            }
          },
        }, '次へ'),
        h('button', {
          type: 'button', class: 'btn btn-block btn-ghost',
          onclick: () => { state.picks = pickers.map((p) => p.value); go('goals'); },
        }, 'もどる'),
      ));
    return;
  }

  // done
  root.append(stepDots(3), h('section', { class: 'card welcome' },
    h('div', { class: 'welcome-emoji', 'aria-hidden': 'true' }, '🎉'),
    h('h2', {}, '準備ができました！'),
    h('p', {}, '次は「やりたいこと」を登録しましょう。'),
    h('p', { class: 'muted small' }, '思いついたことをメモ帳に書いておいて、「まとめて追加」で貼り付けると楽ちんです。'),
    h('div', { class: 'btn-col' },
      h('button', { type: 'button', class: 'btn btn-block', onclick: () => { state.step = 'welcome'; navigate('list'); } }, 'やりたいことを登録する'),
      h('button', { type: 'button', class: 'btn btn-block btn-ghost', onclick: () => { state.step = 'welcome'; navigate('today'); } }, 'あとで'),
    ),
  ));
}
