import { Box, Fab, Tooltip } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export const FloatingScrollButtons = () => {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

  return (
    <Box sx={{ position: 'fixed', right: { xs: 12, md: 24 }, bottom: { xs: 82, md: 24 }, zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Tooltip title="Ir al inicio" placement="left">
        <Fab size="small" color="primary" onClick={scrollToTop} aria-label="Ir al inicio">
          <KeyboardArrowUpIcon />
        </Fab>
      </Tooltip>
      <Tooltip title="Ir al final" placement="left">
        <Fab size="small" color="primary" onClick={scrollToBottom} aria-label="Ir al final">
          <KeyboardArrowDownIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};
