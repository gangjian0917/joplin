import * as React from 'react';
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { WindowIdContext } from '../../../NewWindowOrIFrame';
import { EditorToolbarHostContext } from '../../EditorToolbarHost';
import Toolbar from './Toolbar';

interface Props {
	themeId: number;
	noteToolbar: React.ReactNode;
}

export default function EditorToolbarPortal(props: Props) {
	const slots = useContext(EditorToolbarHostContext);
	const windowId = useContext(WindowIdContext);
	if (!slots.center) return null;

	return createPortal(
		<div className="note-editor-toolbar-portaled">
			<Toolbar themeId={props.themeId} windowId={windowId}/>
			{props.noteToolbar}
		</div>,
		slots.center,
	);
}
