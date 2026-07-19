import express from 'express'
const router = express.Router();

import { deleteUserById, getAllUsers, getUserById, updateUserById } from '../../controllers/Admin/userManagment.js';

import { verifyAdmin } from '../../middlewares/verifyAdmin.js';


router.use(verifyAdmin);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/update/:id', updateUserById);
router.delete('/delete/:id', deleteUserById);

export default router;