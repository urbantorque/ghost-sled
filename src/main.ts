import { App } from './game/app';

// Entry point. Everything in the game is generated in code; there are no asset fetches.

const style = document.createElement('style');
style.textContent = `
  #app { position: fixed; inset: 0; overflow: hidden; background: #121933; }
  .game-canvas { position: absolute; inset: 0; display: block; touch-action: none; outline: none; }
`;
document.head.appendChild(style);

const root = document.getElementById('app')!;
const app = new App(root);
(window as unknown as { __gs: App }).__gs = app;
void app.start().finally(() => document.getElementById('boot')?.remove());
document.getElementById('boot')?.remove();
