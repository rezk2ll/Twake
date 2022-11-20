/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from 'app/atoms/button/button';
import { RemoveIcon } from 'app/atoms/icons-colored';
import { Input } from 'app/atoms/input/input-text';
import {
  invitationEmailsState,
  InvitationType,
  invitationTypeState,
} from 'app/features/invitation/state/invitation';
import React, { useState } from 'react';
import { useRecoilState } from 'recoil';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';
import { useInvitationUsers } from 'app/features/invitation/hooks/use-invitation-users';
import ReachedLimit from './reached-limit';
import Languages from 'app/features/global/services/languages-service';

export default (): React.ReactElement => {
  const [invitations, setInvitations] = useRecoilState(invitationEmailsState);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [notValidEmail, setNotValidEmail] = useState<boolean>(false);
  const [invitationTargetType] = useRecoilState(invitationTypeState);
  const { user } = useCurrentUser();
  const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
  const currentUserEmailDomain = user?.email.split('@').pop();
  const { can_add_invitations, members_limit_reached, allowed_members, allowed_guests } =
    useInvitationUsers();

  const emailExists = (target: string): boolean =>
    !!invitations.find(invitation => invitation.email === target);

  const handleEnter = (event: unknown): void => {
    if ((event as KeyboardEvent).key === 'Enter') {
      handleAdd();
    }
  };

  const handleAdd = (): void => {
    const role = invitationTargetType;
    if (
      emailRegex.test(currentInput) &&
      !emailExists(currentInput) &&
      currentInput.split('@').pop() === currentUserEmailDomain
    ) {
      setInvitations([...invitations, { email: currentInput, role }]);
      setCurrentInput('');
      setNotValidEmail(false);
    } else {
      setNotValidEmail(true);
    }
  };

  const removeEmail = (targetEmail: string): void => {
    setInvitations(invitations.filter(invitation => invitation.email !== targetEmail));
  };

  const handleInput = (event: any): void => {
    setCurrentInput(event.target.value);
    setNotValidEmail(!emailRegex.test(event.target.value) || emailExists(event.target.value));
  };

  const handleRoleChange = (email: string, role: InvitationType): void => {
    if (role === InvitationType.guest && allowed_guests <= 0) return;
    if (role === InvitationType.member && allowed_members <= 0) return;

    const changedInvitations = invitations.map(invitation => {
      if (invitation.email === email) {
        return {
          email,
          role,
        };
      }

      return invitation;
    });

    setInvitations(changedInvitations);
  };

  return (
    <div className="flex flex-col border-transparent w-full">
      {can_add_invitations ? (
        <div className="flex flex-row space-x-2 py-1">
          <div className="basis-5" />
          <div className="flex-1 px-2">
            <Input
              theme="plain"
              placeholder={Languages.t(
                'components.invitation.invitation_input_list.placeholder',
                [],
                'Start typing an email',
              )}
              value={currentInput}
              onKeyDown={handleEnter}
              onChange={handleInput}
              hasError={notValidEmail}
            />
          </div>
          <div className="w-32">
            <Button
              theme="primary"
              disabled={notValidEmail || !currentInput.length}
              onClick={handleAdd}
              className="w-full justify-center"
            >
              {Languages.t('components.invitation.invitation_input_list.add', [], 'Add')}
            </Button>
          </div>
        </div>
      ) : members_limit_reached ? (
        <ReachedLimit />
      ) : (
        <></>
      )}
      <PerfectScrollbar
        className="-mb-4 py-3 overflow-hidden -mx-2 px-2"
        style={{ maxHeight: 'calc(30vh - 100px)', minHeight: 'calc(30vh - 100px)' }}
        options={{ suppressScrollX: true, suppressScrollY: false }}
      >
        {invitations.map(invitation => (
          <div
            className="flex flex-row border-transparent rounded-md space-x-2 py-0.5 my-0.5 mx-2"
            key={invitation.email}
          >
            <div className="basis-1 pt-2">
              <RemoveIcon
                className="cursor-pointer"
                onClick={() => removeEmail(invitation.email)}
              />
            </div>
            <div className="flex-1">
              <Input theme="plain" disabled={true} value={invitation.email} />
            </div>
            <div className="w-32">
              <select
                className="bg-zinc-200 border h-9 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full fill-blue-500 pt-1"
                onChange={e =>
                  handleRoleChange(invitation.email, e.target.value as unknown as InvitationType)
                }
                value={invitation.role}
                disabled={
                  (invitation.role === InvitationType.guest && allowed_members <= 0) ||
                  (invitation.role === InvitationType.member && allowed_guests <= 0)
                }
              >
                <option value={InvitationType.member}>
                  {Languages.t('components.invitation.invitation_input_list.member', [], 'Member')}
                </option>
                <option value={InvitationType.guest}>
                  {Languages.t('components.invitation.invitation_input_list.guest', [], 'Guest')}
                </option>
              </select>
            </div>
          </div>
        ))}
      </PerfectScrollbar>
    </div>
  );
};
