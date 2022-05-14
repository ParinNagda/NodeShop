const express = require('express');
const {check,body} = require('express-validator')

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup',authController.getSignup);

router.get('/reset',authController.getReset);

router.get('/reset/:token',authController.getNewPassword);

router.post('/reset',authController.postReset);

router.post('/login',
            [
               check('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
               body('password','Password length should be grater than 5 characters and alpha numeric').isLength({min:5}).isAlphanumeric().trim(),
            ] ,authController.postLogin);

router.post('/signup',
            [
                check('email').isEmail().withMessage('Please enter a valid email address')
                .custom((value,{req})=>{
                   return User.findOne({email:req.body.email}).then(result=>{
                        if(result) {
                            return Promise.reject('Email already exists');
                        }
                    })
                }).normalizeEmail(),
                body('password','Password length should be grater than 5 characters and alpha numeric').isLength({min:5}).isAlphanumeric().trim(),
                body('confirmPassword').custom((value,{req}) => {
                    if(value !== req.body.password) {
                        throw new Error('Password have to match');
                    }
                    return true;
                }).trim()

            ],authController.postSignup);

router.post('/logout', authController.postLogout);

router.post('/new-password', authController.postNewPassword);


module.exports = router;