import { useState } from 'react';
import { updateAvatar } from '../data/store';
import { L } from '../i18n';
import type { Avatar, Employee } from '../data/types';
import { AvatarImg } from './common';
import { AvatarEditor } from './ProfilePanel';

/** Primer ingreso: cada persona arma su personaje antes de llegar a la oficina. */
export function CharacterSetup({ me }: { me: Employee }) {
  const [avatar, setAvatar] = useState<Avatar>(me.avatar);

  return (
    <div className="login">
      <div className="login-card setup-card">
        <h1 className="setup-title">
          {L(`¡${me.avatar.body === 1 ? 'Bienvenida' : 'Bienvenido'}, ${me.name.split(' ')[0]}!`, `Welcome, ${me.name.split(' ')[0]}!`)}
        </h1>
        <p className="login-sub">
          {L(
            'Antes de llegar a tu puesto, crea tu personaje. Puedes cambiarlo después desde tu perfil.',
            'Before heading to your desk, create your character. You can change it later from your profile.',
          )}
        </p>
        <div className="setup-body">
          <div className="setup-preview">
            <AvatarImg avatar={avatar} size={5} />
            <AvatarImg avatar={avatar} size={5} pose="back" />
          </div>
          <AvatarEditor avatar={avatar} onChange={setAvatar} preview={false} />
        </div>
        <button className="btn btn-primary btn-block" onClick={() => updateAvatar(avatar)}>
          {L('¡Listo, a la oficina!', 'Done, off to the office!')}
        </button>
      </div>
    </div>
  );
}
