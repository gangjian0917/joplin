import { useState } from 'react';
import useAsyncEffect from '@joplin/lib/hooks/useAsyncEffect';
import shim from '@joplin/lib/shim';

// Resolves the list root element as soon as it exists. Previously this used
// waitForElement(), which polls every 10ms — that delay before each note item
// could even start rendering contributed to blank rows during fast scrolling.
// The common case is synchronous: the list container is in the DOM before the
// items mount. A MutationObserver covers the async case immediately, with a
// polling fallback for environments where the observer callback is not
// delivered (seen with fake timers in tests).
const findElement = (elementId: string): HTMLDivElement | null => {
	return document.getElementById(elementId) as HTMLDivElement | null;
};

const useRootElement = (elementId: string) => {
	const [rootElement, setRootElement] = useState<HTMLDivElement>(findElement(elementId));

	useAsyncEffect(async (event) => {
		let element = findElement(elementId);
		if (!element) {
			element = await new Promise<HTMLDivElement>(resolve => {
				const observer = new MutationObserver(() => {
					const found = findElement(elementId);
					if (found) {
						observer.disconnect();
						resolve(found);
					}
				});
				// attributeFilter: the element usually exists but gets its id
				// later, or a different element gets assigned the wanted id.
				observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });

				// Fallback poll: attribute-only changes (e.g. the test
				// reassigning .id) are covered above via childList+subtree, but
				// some environments miss callbacks; polling guarantees liveness.
				const iid = shim.setInterval(() => {
					const found = findElement(elementId);
					if (found) {
						observer.disconnect();
						shim.clearInterval(iid);
						resolve(found);
					}
				}, 10);

				event.onCleanup(() => {
					observer.disconnect();
					shim.clearInterval(iid);
				});
			});
		}
		if (event.cancelled) return;
		setRootElement(element);
	}, [document, elementId]);

	return rootElement;
};

export default useRootElement;
