import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { namedNode } from '@rdfjs/data-model';
import { AccessControlList } from '@inrupt/solid-react-components';
import tictactoeShape from '@contexts/tictactoe-shape.json';
import {
  ldflexHelper,
  errorToaster,
  successToaster,
  buildPathFromWebId,
  notification as helperNotification
} from '@utils';
import { GameFormWrapper, BtnDiv } from './game-form.styles';

type Props = {
  webId: String,
  sendNotification: () => void,
  opponent: string,
  setOpponent: () => void
};

const GameForm = ({ webId, sendNotification, opponent, setOpponent }: Props) => {
  const uniqueIdentifier = Date.now();
  const [documentUri, setDocumentUri] = useState(`${uniqueIdentifier}.ttl`);
  const { t } = useTranslation();

  const reset = () => {
    setDocumentUri('');
    setOpponent('');
  };

  /**
   * Creates the initial game object based on the opponent's webId
   * @param {String} opponent Opponent's webId
   * @returns {Object} Game data
   */
  const initialGame = opponent => ({
    gamestatus: 'Invite Sent',
    createddatetime: moment().format(),
    updateddatetime: moment().format(),
    actor: namedNode(webId),
    opponent: namedNode(opponent),
    firstmove: 'X',
    moveorder: ''
  });

  /**
   * Creates a game with the initial game object and sends a notification to the rival
   * @param {String} documentUri Game document's url
   * @param {String} opponent Opponent's webId
   */
  const createGame = async (documentUri: String, opponent: String) => {
    try {
      /**
       * Get full opponent game path
       */
      const gameSettings = buildPathFromWebId(
        opponent,
        `${process.env.REACT_APP_TICTAC_PATH}/settings.ttl`
      );
      /**
       * Find opponent inboxes from a document link
       */
      const inboxes = await helperNotification.findUserInboxes([
        { path: opponent, name: 'Global' },
        { path: gameSettings, name: 'Game' }
      ]);
      /**
       * If opponent has at least one inbox, create a game and send a notification
       * Otherwise, show an error message
       * */
      if (inboxes.length > 0) {
        const newDocument = await ldflexHelper.createNonExistentDocument(documentUri);
        if (newDocument) {
          const document = await ldflexHelper.fetchLdflexDocument(documentUri);
          const setupObj = initialGame(opponent);

          for await (const field of tictactoeShape.shape) {
            const prefix = tictactoeShape['@context'][field.prefix];
            const predicate = `${prefix}${field.predicate}`;
            await document[predicate].add(setupObj[field.predicate]);
          }
          /**
           * Find the opponent's game-specific inbox. If it doesn't exist, get the global inbox instead
           * @to: Opponent inbox path
           */
          const to = helperNotification.getDefaultInbox(inboxes, 'Game', 'Global');
          const target = `${window.location.href}/${btoa(documentUri)}`;
          await sendNotification(
            {
              title: 'Tictactoe invitation',
              summary: 'has invited you to play Tic-Tac-Toe.',
              actor: webId,
              object: documentUri,
              target
            },
            to.path
          );

          setDocumentUri(`${Date.now()}.ttl`);
        } else {
          errorToaster(`${opponent} ${t('game.createFolder')}`, t('notifications.error'));
        }
      } else {
        errorToaster(`${opponent} ${t('noInboxOpponent.message')}`, t('notifications.error'), {
          label: t('noInboxOpponent.link.label'),
          href: t('noInboxOpponent.link.href')
        });
      }
    } catch (e) {
      throw new Error(e);
    }
  };

  /**
   * Creates a new game based on an opponent's webId and a game document url with an acl file
   * @param {Event} e Submit event
   */
  const onSubmit = async e => {
    try {
      e.preventDefault();
      const documentPath = buildPathFromWebId(
        webId,
        `${process.env.REACT_APP_TICTAC_PATH}${documentUri}`
      );
      await createGame(documentPath, opponent);
      const permissions = [
        { agents: [opponent], modes: [AccessControlList.MODES.READ, AccessControlList.MODES.WRITE] }
      ];
      const ACLFile = new AccessControlList(webId, documentPath);
      await ACLFile.createACL(permissions);
      // await aclTurtle(documentPath, opponent);
      successToaster(t('game.createGameSuccess'), t('notifications.success'));
    } catch (e) {
      errorToaster(e.message, t('game.errorTitle'));
    }
  };

  return (
    <GameFormWrapper onSubmit={onSubmit} data-testid="game-form">
      <h1>{t('game.title')}</h1>
      <hr />
      <form>
        <span>{t('game.createGamePrompt')}</span>
        <div className="input-wrap">
          <label htmlFor="documentUriInput">
            {t('game.idLabel')}
            <input
              id="documentUriInput"
              type="text"
              value={documentUri}
              onChange={e => setDocumentUri(e.target.value)}
              data-testid="uri-input"
            />
          </label>
        </div>
        <div className="input-wrap">
          <label htmlFor="opponentWebId">
            {t('game.opponentWebIDLabel')}
            <input
              id="opponentWebId"
              type="text"
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              data-testid="webId"
            />
          </label>
        </div>
        <BtnDiv>
          <button type="submit" data-testid="form-submit">
            {t('game.createGame')}
          </button>
          <button type="button" onClick={reset}>
            {t('game.resetGameForm')}
          </button>
        </BtnDiv>
      </form>
    </GameFormWrapper>
  );
};

export default GameForm;