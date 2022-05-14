const crypto = require('crypto');

const bcrypt = require('bcryptjs');

const User = require('../models/user');
const mongoose = require('mongoose')
const mailgun = require("mailgun-js");
const {validationResult} = require('express-validator')

const DOMAIN = "sandbox45bcbcc034274dc5a527aacc7fdb2990.mailgun.org";
const mg = mailgun({
	apiKey: "967bfafcc7dac532b9d70d0df09970cf-62916a6c-3b45291c",
	domain: DOMAIN
});


exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if(message.length > 0) {
    message = message[0]
  } else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message,
    OldInput : {
      email : '',
      password:'',
     },
    validationErrors : []   
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  if(message.length > 0) {
    message = message[0]
  } else {
    message = null;
  }
  res.render('auth/signup', {
   path: '/signup',
   pageTitle: 'Sign up',
   isAuthenticated: false,
   errorMessage: message,
   OldInput : {
    email : '',
    password:'',
    confirmPassword:'' 
   },
   validationErrors : []      
 });
};

exports.postLogin = (req, res, next) => {
  let email = req.body.email;
  let password = req.body.password;
  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    return res.status(422)
      .render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        isAuthenticated: false,
        errorMessage: errors.array()[0].msg,
        OldInput : {
          email : email,
          password:password,
         },
        validationErrors : errors.array()   
      });
    
  }
  User.findOne({email:email})
  .then(user=>{ 
    if(!user) {
      console.log('gere');
      req.flash('error','Invalid email address');
      return res.status(422)
      .render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        isAuthenticated: false,
        errorMessage: 'Invalid email address',
        OldInput : {
          email : email,
          password:password,
         },
        validationErrors : [{param:'email'}]   
      });
    }
    bcrypt.compare(password,user.password)
    .then(doMatch => {
      if(doMatch) {
       req.session.isLoggedIn = true;
        req.session.user = user;
        console.log(req.session);
        return req.session.save((err) => {
          console.log(err);
           res.redirect('/');
        })
      }
      return res.status(422)
      .render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        isAuthenticated: false,   
        errorMessage: 'Invalid email password',
        OldInput : {
          email : email,
          password:password,
         },
        validationErrors : [{param:'password'}]   
      });
      
    })
    .catch(err =>{
      console.log(err);
      res.redirect('/login');
    })
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.postSignup = (req,res,next) => {
  const email = req.body.email; 
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const errors = validationResult(req);
  console.log(errors.array());
  
  if(!errors.isEmpty()) {
    return res.status(422)
      .render('auth/signup', {
        path: '/signup',
        pageTitle: 'Sign up',
        isAuthenticated: false,
        errorMessage: errors.array()[0].msg,
        OldInput : {
          email : email,
          password:password,
          confirmPassword:confirmPassword 
         },
         validationErrors : errors.array()  
      });
    
  } 
  bcrypt.hash(password,12)
      .then(hashedpass=>{
        const user = new User({
          email:email,
          password:hashedpass,
          cart:{items:[]}
        });
        return user.save();
      }).then(result=>{
        res.redirect('/login');
        const data = {
          from: "Mailgun Sandbox <postmaster@undefined>",
          to: email,
          subject: "Signup successful",
          text: "<h1>You have successfully signed up</h1>"
        };
        mg.messages().send(data, function (error, body) {
          console.log(body);
        });
        
      })
  .catch(err =>{
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  })
}

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash('error');
  if(message.length > 0) {
    message = message[0]
  } else {
    message = null;
  }
  res.render('auth/reset', {
   path: '/reset',
   pageTitle: 'Reset password',
   isAuthenticated: false,
   errorMessage: message 
 });
};

exports.postReset = (req,res,next) => {
  crypto.randomBytes(32,(err,buffer) => {
    if(err) {
      console.log(err);
      return res.redirect('/')
    }
    const token = buffer.toString('hex')
    User.findOne({email:req.body.email}).then(result=>{
      if(!result) {
        req.flash('error','No account exists with email' + req.body.email);
        return res.redirect('/reset');
      }
      result.resetToken = token;
      result.resetTokenExpiration = Date.now() + 3600000
      return result.save()
    })
    .then(result => {
        res.redirect('/login');
        const data = {
          from: "Mailgun Sandbox <postmaster@undefined>",
          to: req.body.email,
          subject: "Reset password",
          html: `
          <p>You requested a password reset</p>
          <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password</p>
          `
        };
        return mg.messages().send(data, function (error, body) {
          console.log(body);
        });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
     })
  })
} 

exports.getNewPassword = (req,res,next) => {
  const token = req.params.token;
  User.findOne({resetToken:token,resetTokenExpiration:{$gt:Date.now()}})
  .then(user=>{
    let message = req.flash('error');
    if(message.length > 0) {
      message = message[0]
    } else {
      message = null;
    }
      res.render('auth/new-password', {
      path: '/new-password',
      pageTitle: 'Reset password',
      isAuthenticated: false,
      errorMessage: message,
      userId:user._id.toString(),
      passwordToken:token  
    });
  })
  .catch(err=> {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }) 
  
}

exports.postNewPassword = (req,res,next) =>{
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const token = req.body.passwordToken;
  let resetUser;
  User.findOne({resetToken:token,resetTokenExpiration:{$gt:Date.now()},_id:userId})
  .then(user => {
    resetUser = user;
    return bcrypt.hash(newPassword,12)
    }).then(hashedpass=>{
        resetUser.password = hashedpass;
        resetUser.resetToken = undefined;
        resetUser.resetTokenExpiration = undefined;
        return resetUser.save();
    })
    .then(result=>{
      res.redirect('/login');
    }).catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
  }) 
}