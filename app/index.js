'use strict';
var util = require('util');
var path = require('path');
var chalk = require('chalk');
var yeoman = require('yeoman-generator');
var globule = require('globule');
var shelljs = require('shelljs');


var PlaybookGenerator = module.exports = function PlaybookGenerator(args, options, config) {
  yeoman.generators.Base.apply(this, arguments);

  var dependenciesInstalled = ['bundle', 'ruby'].every(function (depend) {
    return shelljs.which(depend);
  });

  // Exit if Ruby dependencies aren't installed
  if (!dependenciesInstalled) {
    console.log('Looks like you\'re missing some dependencies.' +
      '\nMake sure ' + chalk.white('Ruby') + ' and the ' + chalk.white('Bundler gem') + ' are installed, then run again.');
    shelljs.exit(1);
  }

  this.gitInfo = {
    name: this.user.git.username,
    email: this.user.git.email
  }

  this.on('end', function () {
    this.installDependencies({ skipInstall: options['skip-install'] });
  });

  this.pkg = JSON.parse(this.readFileAsString(path.join(__dirname, '../package.json')));
};

util.inherits(PlaybookGenerator, yeoman.generators.Base);

PlaybookGenerator.prototype.askForUser = function askForUser() {
  var cb = this.async();
  var prompts = [
    {
      name: 'authorName',
      message: 'What is your name?',
      default: this.gitInfo.name
    },
    {
      name: 'authorEmail',
      message: 'What is your email?',
      default: this.gitInfo.email
    },
    {
      name: 'projectName',
      message: 'What is the name of the project?'
    }
  ];

  console.log(this.yeoman);
  console.log(chalk.yellow('\nTell us a little about the project.') + ' →');

  this.prompt(prompts, function (props) {

    this.authorName  = props.authorName;
    this.authorEmail = props.authorEmail;
    this.projectName = props.projectName;

    cb();
  }.bind(this));
};

PlaybookGenerator.prototype.askForTools = function askForTools() {
  var cb = this.async();
  var prompts = [
    {
      name: 'jsPre',
      type: 'list',
      message: 'JavaScript preproccesor',
      choices: ['None', 'CoffeeScript']
    },
    {
      name: 'googleAnalytics',
      type: 'confirm',
      message: 'Include Google Analytics?'
    }
  ]

  console.log(chalk.yellow('\nPreprocessors and tools.') + ' →');

  this.prompt(prompts, function (props) {

    this.googleAnalytics = props.googleAnalytics;

    // Multiple choice 'None' to false
    this.jsPre = props.jsPre === 'None' ? false : props.jsPre.toLowerCase();

    cb();
  }.bind(this));
};

PlaybookGenerator.prototype.askForDeployment = function askForDeployment() {
  var cb = this.async();
  var prompts = [
    {
      name: 'deploy',
      message: 'Use grunt-build-control for deployment?',
      type: 'confirm'
    },
    {
      name: 'deployHost',
      type: 'list',
      message: 'Host to deploy to',
      choices: ['GitHub Pages', 'Heroku'],
      when: function (answers) {
        return answers.deploy;
      }
    },
    {
      name: 'ghOwner',
      message: 'GitHub repository owner',
      when: function (answers) {
        return answers.deployHost === 'GitHub Pages';
      }
    },
    {
      name: 'ghRepo',
      message: 'GitHub repository name',
      when: function (answers) {
        return answers.deployHost === 'GitHub Pages';
      }
    },
    {
      name: 'herokuRepo',
      message: 'Heroku app name',
      when: function (answers) {
        return answers.deployHost === 'Heroku';
      }
    },
    {
      name: 'ghPagesProject',
      type: 'list',
      message: 'GitHub Project or User/Organization site?',
      choices: ['Project', 'User/Organization'],
      when: function(answers) {
        return answers.deployHost == 'GitHub Pages';
      }
    },
    {
      name: 'deployBranch',
      message: 'Branch to deploy to',
      default: function(answers) {
        if (answers.ghPagesProject === 'Project') {
          return 'gh-pages';
        } else {
          return 'master';
        };
      },
      when: function (answers) {
        return answers.deploy;
      }
    }
  ]

  console.log(chalk.yellow('\nDeployment options.') + ' →');

  this.prompt(prompts, function (props) {

    this.deploy         = props.deploy;
    this.deployBranch   = props.deployBranch;
    this.ghOwner        = props.ghOwner;
    this.ghRepo         = props.ghRepo;
    this.deployHost     = props.deployHost;

    if (props.ghPagesProject) {
      this.ghPagesProject = props.ghPagesProject.replace('/', '_').toLowerCase();
    }

    if (this.deployHost == 'Heroku') {
      this.deployRemote = 'git@heroku.com:' + props.herokuRepo + '.git';
    } else {
      this.deployRemote = 'git@github.com:' + this.ghOwner + '/' + this.ghRepo + '.git';
    }

    cb();
  }.bind(this));
};

PlaybookGenerator.prototype.rubyDependencies = function rubyDependencies() {
  this.template('Gemfile');
  this.conflicter.resolve(function (err) {
    if (err) {
      return this.emit('error', err);
    }
    shelljs.exec('bundle install');
  });
};

PlaybookGenerator.prototype.app = function app() {
  this.directory('app', 'app');
  this.copy('Gemfile', 'Gemfile');
  this.copy('bowerrc', '.bowerrc');
  this.copy('csslintrc', '.csslintrc');
  this.copy('gitignore', '.gitignore');
  this.template('_Gruntfile.js', 'Gruntfile.js');
  this.template('config.yml', '_config.yml');
  this.template('_config.build.yml', '_config.build.yml');
  this.template('_package.json', 'package.json');
  this.template('_bower.json', 'bower.json');
  this.template('_README.MD', 'README.md');
};

PlaybookGenerator.prototype.projectfiles = function projectfiles() {
  this.copy('editorconfig', '.editorconfig');
  this.copy('jshintrc', '.jshintrc');
};

PlaybookGenerator.prototype.templates = function templates() {
  this.template('conditional/template/default.html', 'app/_layouts/default.html');
  this.template('conditional/template/index.html', 'app/index.html');

  if (this.googleAnalytics) {
    this.copy('conditional/template/google-analytics.html', 'app/_includes/google-analytics.html');
  };
};

PlaybookGenerator.prototype.jsPreprocessor = function jsPreprocessor() {
  if (this.jsPre === 'coffeescript') {
    this.mkdir('app/assets/_coffee');
    this.copy('conditional/coffee/README.md', 'app/assets/_coffee/README.md');
    this.copy('conditional/coffee/app.coffee', 'app/assets/_coffee/app.coffee');
  }
};

PlaybookGenerator.prototype.installBitters = function installBitters() {
  // Install Bitters
  shelljs.cd('app/assets/_scss');
  shelljs.exec('bitters install');
  shelljs.cd('../../../');

  // Assimilate Bitters files
  shelljs.mv('app/assets/_scss/bitters/*', 'app/assets/_scss/base/');

  // Remove styled ID's
  shelljs.sed('-i', /(, #flash_)(?:failure|notice|success)\s{/g, ' {', 'app/assets/_scss/base/_flashes.scss');

  // Remove Bitters directory & file
  shelljs.rm('-rf', 'app/assets/_scss/bitters');
  shelljs.rm('-f', 'app/assets/_scss/base/_bitters.scss');

  // Install additional mixins
  shelljs.mv('app/assets/_scss/base/_mixins/_*', 'app/assets/_scss/base/mixins/')
  shelljs.cat('app/assets/_scss/base/_mixins/imports.scss').toEnd('app/assets/_scss/base/mixins/_base.scss');
  shelljs.rm('-rf', 'app/assets/_scss/base/_mixins');
};