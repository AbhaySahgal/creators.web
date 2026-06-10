import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Legacy route — redirects to B9 account deletion hub. */
export function DeleteAccountRequestSuccess() {
	const navigate = useNavigate();
	useEffect(() => {
		void navigate('/delete-account', { replace: true });
	}, [navigate]);
	return null;
}
