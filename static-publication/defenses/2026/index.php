<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

$staticAccessLinks = json_decode(<<<'STATIC_ACCESS_JSON'
[{"year":2026,"hash":"a8edd4b4f60aff12f9e9f44f43573eaf4b4727e2474e8417242c17b8ec9c1ae9","personId":"69ddfbf8e910b6872d05c8aa","name":"Amstutz Gabriele","email":"amstutz.gabriele@tpiorganizer.ch","expiresAt":"2026-05-06T06:52:09.331Z"},{"year":2026,"hash":"204310aaa866deb84290b87ff363cde601e3d54fddd16531dbf7bb3f064d8845","personId":"69ddfbf8e910b6872d05c8c2","name":"Roudet Alexy Julien","email":"roudet.alexyjulien@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.659Z"},{"year":2026,"hash":"c6c1c9a0e6b3a82f81cb85682c4074e8edbc33e97441c3a456b1bfc1cb937005","personId":"69dbb567d9434724eaa11276","name":"Mikael Gonzalez","email":"mikael.gonzalez7@gmail.com","expiresAt":"2026-05-06T06:04:53.654Z"},{"year":2026,"hash":"13f963d83e7c3c892973e71f1c3cf101b7849075147e408a6c603d2618099970","personId":"69ddfbf8e910b6872d05c8d7","name":"Lordon Lucas","email":"lordon.lucas@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.649Z"},{"year":2026,"hash":"d308b6cd006d3078b8ea8e47c5f32cc396ed112b0e3b1b90e3b8e5d52c9410ed","personId":"69ddfbf8e910b6872d05c8ef","name":"Rodrigues Sousa Tiago","email":"rodrigues.sousatiago@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.644Z"},{"year":2026,"hash":"7c19d6a9783b0b6cfc4af11814b92b0302af8a9a90285bfdb16711992cbd2d19","personId":"69e60b5412f10335dc69cbf5","name":"Laurent Deschamps","email":"laurent.deschamps@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.639Z"},{"year":2026,"hash":"b638efd96348b23562592d8c92fd34c3ee078a0591e4bbefee7b055353d3b3a0","personId":"69dbb567d9434724eaa11237","name":"Alain Pittet","email":"alain.pittet@info-domo.ch","expiresAt":"2026-05-06T06:04:53.633Z"},{"year":2026,"hash":"9f0393f45655d93e9a51e381804db21e877326f3ca64b6e5276bbf1db0446157","personId":"69ddfbfae910b6872d05cb02","name":"Skupovska Veronika","email":"skupovska.veronika@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.628Z"},{"year":2026,"hash":"02f569f453e63447bfc8c3c9ad7e38a9532ef71594a7a2566000094bc2e5e491","personId":"69ddfbf9e910b6872d05c970","name":"Belkhiria Sofiene Habib","email":"belkhiria.sofienehabib@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.623Z"},{"year":2026,"hash":"0523feb445d34e3786fefeae0cb6380907a6578de3184db80d768e15c4a2384f","personId":"69dbc07289ecf04f8410021d","name":"Londero Maeva","email":"maeva.londero@epfl.ch","expiresAt":"2026-05-06T06:04:53.616Z"},{"year":2026,"hash":"5dce084e2a9ac19f80cc7b00540b6e7bdc5db24fbb1998af6714c0c29477155d","personId":"69dbc0c389ecf04f8410025f","name":"Bertrand Sahli","email":"bertrand.sahli@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.610Z"},{"year":2026,"hash":"f7a82bdde7d8db3a58dad42578705b059a50c0873340703045c9d0658ddc1c1b","personId":"69dbb567d9434724eaa1127c","name":"Olivier Mellina","email":"mellina.olivier@gmail.com","expiresAt":"2026-05-06T06:04:53.606Z"},{"year":2026,"hash":"07e9601dd7a65c38fa7a2ec8a60a6dd4abdd644be2fedb7fd64cafd4cab225c8","personId":"69e4e15e10790eb80e9b4f65","name":"Carneiro Yohan","email":"carneiro.yohan@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.600Z"},{"year":2026,"hash":"dc4443a9546c238530f4696aab4fe3826b72d09e89bc2c3d28ccaa524a15cebc","personId":"69dbc07289ecf04f8410023d","name":"Roberto Ferrari","email":"roberto.ferrari@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.595Z"},{"year":2026,"hash":"d967921eea485e09d4c27a391f84a21e4e19a5c166a8306ddf2066060ccf97b4","personId":"69ddfbf9e910b6872d05c91c","name":"Racine Thibaud","email":"racine.thibaud@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.589Z"},{"year":2026,"hash":"c7f0ed95339b50b1c83bba8ac79992696495e979f4e94629655d4c1e0694bbe3","personId":"69dbc07289ecf04f8410020c","name":"Cédric Schaffter","email":"cedric.schaffter@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.584Z"},{"year":2026,"hash":"578c7ee881d99904fe0d550214f48cac310eb0253fd518368d6cb613f060afa2","personId":"69dbb567d9434724eaa11240","name":"Bernard Oberson","email":"oberson.bernard@gmail.com","expiresAt":"2026-05-06T06:04:53.579Z"},{"year":2026,"hash":"0bdfd1b8f9e5ee8f456e2caea5ede1485c3319c21cffb8023d0d080d4236a46c","personId":"69ddfbf9e910b6872d05c9b5","name":"Almeida Sampaio Nelson Filipe","email":"almeida.sampaionelsonfilipe@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.573Z"},{"year":2026,"hash":"aba9a18b9089515b1a2b65862029e723d1f0e93f8ae40eb60557f2e51b839843","personId":"69e754332ccbf98274ca0810","name":"Albert Richard","email":"albert.richard@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.567Z"},{"year":2026,"hash":"0f470c1c02e2e6db35fad907c25b50edc8b994f06b991a4057fe5c43704fcff4","personId":"69dbc07289ecf04f8410020f","name":"Patrick Chenaux","email":"patrick.chenaux@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.562Z"},{"year":2026,"hash":"0b3e5121125da9ed33ab535db1e83ee75a42008e9593f4edb041b5f184be06d7","personId":"69ddfbfae910b6872d05ca7e","name":"Denis Matias","email":"denis.matias@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.556Z"},{"year":2026,"hash":"049e434fb7846cbe21bd01c49463e0426c5ac46d2b086d2c7b49d4d3a50054c8","personId":"69dbc07289ecf04f84100212","name":"Laurent Duding","email":"laurent.duding@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.551Z"},{"year":2026,"hash":"6d3810ce6ade456a62b1e91913467329024f8d888be47d87ff42b8cb21c65591","personId":"69ddfbf9e910b6872d05c9ca","name":"Mohamed Zarook Mohamed Zaahid","email":"mohamed.zarookmohamedzaahid@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.546Z"},{"year":2026,"hash":"7e46603d158aa6c7714f006a6c68e4c4d0bb8ccf4061fc45fab9b0d5803dd67b","personId":"69dbc07289ecf04f84100220","name":"Cédric Kind","email":"cedric.kind@paleo.ch","expiresAt":"2026-05-06T06:04:53.540Z"},{"year":2026,"hash":"150cceb39308edc699254b0069cd2c769576d68c81f1c2960f163b12192b71e1","personId":"69ddfbfae910b6872d05cb17","name":"Morier Mina","email":"morier.mina@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.535Z"},{"year":2026,"hash":"3a4875bc6300df93262b7d612e7c6fece191a10bb6ac7e9da18734a56bef3a64","personId":"69dbc07289ecf04f84100217","name":"Guillaume Blanco","email":"guillaume.blanco@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.530Z"},{"year":2026,"hash":"3b3993ac4855b29a629d386a3c06879615f3beae9c87b741d4db6bbce54333d1","personId":"69ddfbf9e910b6872d05c95b","name":"Al Hussein Mussa","email":"al.husseinmussa@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.524Z"},{"year":2026,"hash":"f5bd61581e0d4b8a39a6083ea4a3e78a1388cf8dbe11faea38bf00d0fdfad13a","personId":"69dbc07289ecf04f84100206","name":"Mathieu Meylan","email":"mathieu.meylan@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.519Z"},{"year":2026,"hash":"f985375444efebce1ed77510f2f66b1ca465ea66b2096b2293ae156a87fccd1a","personId":"69dbb567d9434724eaa11258","name":"Gabriel Maret","email":"gab.maret@gmail.com","expiresAt":"2026-05-06T06:04:53.514Z"},{"year":2026,"hash":"fbfe5c2d1040af7c004c1851fbaffef973ddbd38ad93ad63c614ef404ac5f9bb","personId":"69ddfbf9e910b6872d05c99a","name":"Velickovic Mateja","email":"velickovic.mateja@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.508Z"},{"year":2026,"hash":"3874a7cce18f144eddab6dcca26db720cbd5a426e7647036a5da631bd0df518e","personId":"69dbc07289ecf04f841001f4","name":"Alexis Gugler","email":"alexis.gugler@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.503Z"},{"year":2026,"hash":"035b950deede5d9bd931f3b6616bd437ca934107abc4bc32c1415b1f6382dc61","personId":"69ddfbfae910b6872d05ca93","name":"Tecle Siem Biniam","email":"tecle.siembiniam@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.498Z"},{"year":2026,"hash":"e7e9923c036d111d0296ad51c9a1a6792f6148444837b8489d3363cbfa0cfbd1","personId":"69dbb567d9434724eaa1126d","name":"Max Roy","email":"max.roy@netzys.ch","expiresAt":"2026-05-06T06:04:53.492Z"},{"year":2026,"hash":"b978604b2ff41335ae325c3a2f8bc6fc0654f8e34d969c0584ab9bfeda13fcf4","personId":"69dbb567d9434724eaa1123d","name":"Arnaud Sartoni","email":"arnaud.sartoni@epfl.ch","expiresAt":"2026-05-06T06:04:53.487Z"},{"year":2026,"hash":"146d71964c347a4c607d47397b1a37fae45007070229bafd57e6ac866edd65f1","personId":"69ddfbf9e910b6872d05ca0f","name":"Moser Even Gavrie","email":"moser.evengavrie@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.482Z"},{"year":2026,"hash":"ad0089c25318188cfe7453e9042c5d8b70e891256eed25567dbf39e9bd3ca2b9","personId":"69dbc07289ecf04f841001fd","name":"Sheyla Oliveira Kobi","email":"sheyla.oliveira@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.476Z"},{"year":2026,"hash":"3f9f829249e6bd88065c971952449ec31234e4eb64579e3d715a3df7bb56d980","personId":"69ddfbfae910b6872d05ca39","name":"Wu Guoxu","email":"wu.guoxu@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.470Z"},{"year":2026,"hash":"c1577d03b2ca062038548b0bf28dc374979c84d919466f632b83dceac8a52edc","personId":"69dbb567d9434724eaa11282","name":"Raphaël Favre","email":"raphael.favre@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.463Z"},{"year":2026,"hash":"23b56f139f7ea244274bbe76382fa4de8cbbeaf8d1dcb823fc916965bcf3e984","personId":"69dbb567d9434724eaa1123a","name":"Alexandre Graf","email":"alg@web-services.com","expiresAt":"2026-05-06T06:04:53.458Z"},{"year":2026,"hash":"c4d73f2ea431d68c94a0c2a796fc3c3485c8afcad42ecc21fc18758e38daf28c","personId":"69ddfbfae910b6872d05cb45","name":"Ristic Christopher","email":"ristic.christopher@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.452Z"},{"year":2026,"hash":"fac78eaaccfd3c1628f78b8f16f6fe6dd7c2f5d4e30d0dc53d91895d41bc7506","personId":"69dbb567d9434724eaa1125e","name":"Jean-Luc Roduit","email":"dedecop2@gmail.com","expiresAt":"2026-05-06T06:04:53.448Z"},{"year":2026,"hash":"8858a997a7ca82e2a35b78ce4e7f0e40b63cba7c048c2ee87d05f1be764aaa6b","personId":"69ddfbf9e910b6872d05ca24","name":"Pages Marius","email":"pages.marius@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.442Z"},{"year":2026,"hash":"40b9465623a8f7dde2c9e9dfc1759102efbb3deec2e4c61f0e04457a5d9ad073","personId":"69ddfbfae910b6872d05cadb","name":"Alain Girardet","email":"alain.girardet@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.436Z"},{"year":2026,"hash":"73d19326ab279107a569a4d3cf3d92b3ae2932db55da32f34e295671cee44a8c","personId":"69dbb567d9434724eaa1128e","name":"Suleyman Ceran","email":"sueleyman.ceran@gmail.com","expiresAt":"2026-05-06T06:04:53.429Z"},{"year":2026,"hash":"0d204d20e5c5c8c9d4a2eb18914ee8602f724f58a67aa2fa85c0f224a5caab8f","personId":"69ddfbf9e910b6872d05c946","name":"Mares Julien Pierre","email":"mares.julienpierre@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.424Z"},{"year":2026,"hash":"83619951ebc27362496b6cec1e806462d63588d2118ef90eb05aa7bbd249e864","personId":"69ddfbf9e910b6872d05c931","name":"Moia Luke","email":"moia.luke@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.419Z"},{"year":2026,"hash":"88c760d3238cd269a1f2cdaf05b1392b7e1858cd2e1d89a2b3c9bbc6417d9df2","personId":"69dbc07289ecf04f841001fa","name":"Helder Manuel Costa Lopes","email":"helder.costa@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.415Z"},{"year":2026,"hash":"f5f51772fbe6d1e8d3dfef61ba1d5740e4c078fe7f9a4bc1e533dae930f94392","personId":"69dbc07289ecf04f8410023a","name":"Antoine Mveng Evina","email":"antoine.mveng@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.410Z"},{"year":2026,"hash":"37454831aedcb5e61909a2372ed41bd145e322ad398af54a5b618c55b0ab7a8c","personId":"69dbb567d9434724eaa1128b","name":"Sofia Roy","email":"sofia.roy@netzys.ch","expiresAt":"2026-05-06T06:04:53.404Z"},{"year":2026,"hash":"d2bdc4b3c8eb5dd902f9270b1dd0e75188dbdd686b46af5d9a2956ed213c2526","personId":"69ddfbf9e910b6872d05c9df","name":"Khalil Mateen Salem","email":"khalil.mateensalem@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.400Z"},{"year":2026,"hash":"4fa3b13a0fe1d5bd9692b80557780a2da061221408edbc8f0ac1e5f483f504ae","personId":"69dbc07289ecf04f84100229","name":"Grégory Charmier","email":"gregory.charmier@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.394Z"},{"year":2026,"hash":"f1f5fd3c3c681ddb42520f62eebb7411a248e209330a7f989dd4b69620d02aac","personId":"69ddfbfae910b6872d05ca4e","name":"Lopardo Alessio","email":"lopardo.alessio@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.389Z"},{"year":2026,"hash":"28723ede5baa82890467b3c334447d07ed758a36e4867b539e87d403810c642c","personId":"69dbc07289ecf04f84100203","name":"Dimitrios Lymberis","email":"dimitrios.lymberis@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.384Z"},{"year":2026,"hash":"bd35e6821cc1c2f98c25f6a5d711f6286264088cc87b5df14405d732c2a4c210","personId":"69dbb567d9434724eaa1124f","name":"Diego Criscenti","email":"diego.criscenti@hepl.ch","expiresAt":"2026-05-06T06:04:53.378Z"},{"year":2026,"hash":"2c9c24d208c156bc539bc75c37ee1231d21b72f557996884ffaa5b0beea84ab9","personId":"69dbb567d9434724eaa11264","name":"Luc Venries","email":"luc.venries@epfl.ch","expiresAt":"2026-05-06T06:04:53.372Z"},{"year":2026,"hash":"56fe76962ffcf6262156d313137e9526749bd609d0b157d4015d554e176dc8bd","personId":"69ddfbf9e910b6872d05c985","name":"Metroz Quenti","email":"metroz.quenti@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.368Z"},{"year":2026,"hash":"949788b28c5470c902f11d365a4032d1168cf9a08a18d61e801d453ccf553f66","personId":"69dbb567d9434724eaa11291","name":"Volkan Sutcu","email":"volkan.sutcu@hotmail.com","expiresAt":"2026-05-06T06:04:53.363Z"},{"year":2026,"hash":"d53d60704d525f75cae35f2417a279842fc5ecb72013864bdd0a5373f16fa0b4","personId":"69ddfbfae910b6872d05cabd","name":"Rodrigues Lopes Diogo Filipe","email":"rodrigues.lopesdiogofilipe@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.357Z"},{"year":2026,"hash":"cc844d6f4768b04b628439ea5b9a35b1cd6f7089481f56288e436c1cbb0d3ad4","personId":"69dbc07289ecf04f84100200","name":"Alain Garraux","email":"alain.garraux@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.353Z"},{"year":2026,"hash":"17055a3fd425fbe20225ab3b244358bce4c8111320bfa7f9f2df27e63fae1db0","personId":"69dbc07289ecf04f8410022c","name":"Xavier Carrel","email":"xavier.carrel@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.348Z"},{"year":2026,"hash":"9b3d6f771639726e1d48578fe2826889e6f6f656ad36abe709321a90b48753c1","personId":"69dbc07289ecf04f84100237","name":"Pascal Piot","email":"pascal.piot@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.342Z"},{"year":2026,"hash":"692a3667b8b69ed42804f8e279aa146ffc73736b0c31b57216d9a39e95b16f1f","personId":"69dbb567d9434724eaa11252","name":"Ernesto Montemayor","email":"ernesto@bati-technologie.ch","expiresAt":"2026-05-06T06:04:53.337Z"},{"year":2026,"hash":"9b5777034f83afabb9d89de342158fbdad4f4e17942e6aa6db0801cdebe114aa","personId":"69dbc07289ecf04f8410021a","name":"Romain Rosay","email":"romain.rosay@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.333Z"},{"year":2026,"hash":"4e568cb764fa1def09f6af2585308e926b1387d75741116e109b7d7e854b7be2","personId":"69dbb567d9434724eaa11249","name":"Claude-Albert Muller Theurillat","email":"expertclaude65@gmail.com","expiresAt":"2026-05-06T06:04:53.328Z"},{"year":2026,"hash":"497a3f908ee1ea3bc99d487acdf8086d4a4fa42e4bfff328655a543afc3931ac","personId":"69dbc07289ecf04f84100240","name":"Gael Sonney","email":"gael.sonney@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.322Z"},{"year":2026,"hash":"3da994fe55688aa3a84ca3aafd134b2bb325d308180199744cc5f26fe4dc12fb","personId":"69e609d712f10335dc69cb3c","name":"Nemanja Pantic","email":"nemo.pantic@gmail.com","expiresAt":"2026-05-06T06:04:53.318Z"},{"year":2026,"hash":"e06bec4e49e579e864db05db2899115e414b1567f10a82389eb4ae759fc02059","personId":"69dbb567d9434724eaa11267","name":"Mathias Giroud","email":"giroud@cinformatique.ch","expiresAt":"2026-05-06T06:04:53.313Z"},{"year":2026,"hash":"bad1960dc88b957e22b5c161785f27b0752ffc1c0fe72447ee1490df17a88a18","personId":"69dbb567d9434724eaa11279","name":"Nicolas Borboën","email":"nicolas.borboen@epfl.ch","expiresAt":"2026-05-06T06:04:53.307Z"},{"year":2026,"hash":"65cd4f9cf13d67d998e852ec1088b7ee23ad9e0305947e34e81f834cc9a01712","personId":"69ddfbf8e910b6872d05c907","name":"Nardou Thomas Louis","email":"nardou.thomaslouis@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.302Z"},{"year":2026,"hash":"1cf27e0ed2330cb2e9ac16c794bc8f62156306252aed706d8e96dcadfbaf10b4","personId":"69dbc07289ecf04f84100231","name":"Jonathan Melly","email":"jonathan.melly@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.298Z"},{"year":2026,"hash":"2e7264266847a313e70ded5ef10a09b30d26c6fcd96ad15311d266bff37111ba","personId":"69dbb567d9434724eaa11270","name":"Michael Wyssa","email":"michael.wyssa@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.292Z"},{"year":2026,"hash":"ad3f9b4595bf91563c0aafa95ade3671e43ead6b800f9a829f89422572c43570","personId":"69dbb567d9434724eaa11288","name":"Serge Wenger","email":"serge.wenger@matisa.ch","expiresAt":"2026-05-06T06:04:53.287Z"},{"year":2026,"hash":"30061bfbb73a085218c82db4e54b1d87d0a44283e21893e5ca8b9a026b6a8e2f","personId":"69dbc07289ecf04f84100234","name":"Aurélie Curchod","email":"aurelie.curchod@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.280Z"},{"year":2026,"hash":"73ca90238e8b6c258626bcbecb485ca1f32bd3931a7da78c6a8c90d67767f9c9","personId":"69dbb567d9434724eaa1127f","name":"Pascal Benzonana","email":"pascal.benzonana@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.273Z"},{"year":2026,"hash":"e8a203f756ea3d348c82aacf47467e08248a9086791d12bb29d0a7e3a285a870","personId":"69dbc07289ecf04f841001f7","name":"Isabelle Stucki","email":"isabelle.stucki@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.267Z"},{"year":2026,"hash":"378f5e2ebe19b2f50ca34c2e134250b684e075c015dabca52157e89352e95f65","personId":"69dbb567d9434724eaa1125b","name":"Jason Crisante","email":"jasoncrisantepro@outlook.com","expiresAt":"2026-05-06T06:04:53.261Z"},{"year":2026,"hash":"8b94049dd82fde4db875f3d04f9baddfc0d045363705fa47d32356504df13da9","personId":"69dbb567d9434724eaa1124c","name":"Daniel Berney","email":"daniel.berney@heig-vd.ch","expiresAt":"2026-05-06T06:04:53.255Z"},{"year":2026,"hash":"85b810fade142fd8c6b1a3a26c677c2cef4554b57de74ad8f9ecd392f1b05058","personId":"69ddfbf8e910b6872d05c895","name":"Diezi Valentin","email":"diezi.valentin@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.248Z"},{"year":2026,"hash":"f444296054959635cdbe085f8c1f585dac81bb21d553f0f2e9b4caf597cac2d6","personId":"69dbb567d9434724eaa11261","name":"Karim Bourahla","email":"karim.bourahla@eduvaud.ch","expiresAt":"2026-05-06T06:04:53.242Z"},{"year":2026,"hash":"04920b22036fadaea26b8a70ef432e717270d943eda34a20260bcad5f9c8f087","personId":"69dbb567d9434724eaa11273","name":"Michel Ange Delgado","email":"michel.delgado@bluewin.ch","expiresAt":"2026-05-06T06:04:53.236Z"},{"year":2026,"hash":"c9c4a92e29c8963e6fb256f55b984b79baeccfdad546dc42197c15f37573d61f","personId":"69dbb567d9434724eaa11246","name":"Carlos Perez","email":"carlos.perez@epfl.ch","expiresAt":"2026-05-06T06:04:53.230Z"},{"year":2026,"hash":"c73f61b33b425daa6452c91bca89d4eedffeabc71e4b94566e01db35d71a3d27","personId":"69ddfbf8e910b6872d05c8aa","name":"Amstutz Gabriele","email":"amstutz.gabriele@tpiorganizer.ch","expiresAt":"2026-05-06T06:04:53.158Z"},{"year":2026,"hash":"1e6be43d7658d28d7ef7f7b2ae9e217054f3b72954e5ac8b6d787490f2c39da4","personId":"69f34bc12532dd27fd9f8371","name":"Toledo Campoverde Adrian Federico","email":"d.c.tfederico.26.lrpjtj@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.556Z"},{"year":2026,"hash":"1e51778ed190896143cedeee8dbd3f95100a1eba2694dade1e7318de1c6bd644","personId":"69f34bc12532dd27fd9f8363","name":"Fleurdelys Brendan","email":"d.c.fbrendan.26.p38y5a@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.552Z"},{"year":2026,"hash":"259727a73a4396aef1197a385dc402b96ef641e56239b2342dbee227e08de132","personId":"69f34bc12532dd27fd9f8357","name":"Berchel Joachim Siméon Gabrie","email":"d.c.bgabrie.26.0k8quw@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.549Z"},{"year":2026,"hash":"0f3906746db2672a7667c6c17fa0401cf0546bae0275914be88c8d4c35323d11","personId":"69e754332ccbf98274ca0810","name":"Albert Richard","email":"albert.richard@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.547Z"},{"year":2026,"hash":"e2f2926dbc4546d3a027041fea564e398f3166f32dee8836d414bd07d0a705f4","personId":"69e60b5412f10335dc69cbf5","name":"Laurent Deschamps","email":"laurent.deschamps@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.544Z"},{"year":2026,"hash":"2f3398a9794f8526a90937b3d05ed01c559c52c122979894795137f14a9d933b","personId":"69e609d712f10335dc69cb3c","name":"Nemanja Pantic","email":"nemo.pantic@gmail.com","expiresAt":"2026-05-06T05:46:50.541Z"},{"year":2026,"hash":"e7ee077f10cb8a5f306a3aa626d859ff32918b5966826e2c8ab91f66ff8389ff","personId":"69e50ad59c07587649d6ac7c","name":"Zarrabi Nima Amir Aram","email":"d.c.zaram.26.hn2ujj@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.538Z"},{"year":2026,"hash":"12a2b499d9fc8183148489e1d3cce66116cb6a864b614748150fa8f54201f249","personId":"69e50ad59c07587649d6ac6e","name":"Sousa Francisco","email":"d.c.sfrancisc.26.cxd7pi@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.535Z"},{"year":2026,"hash":"2d4e2ac95eee2c9403edbfca27f5549fb501bb0550ab20a9d368c6b498666fd5","personId":"69e50ad49c07587649d6ac67","name":"Simões Pólvora Luc","email":"d.c.sluc.26.51odec@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.531Z"},{"year":2026,"hash":"807ee0b97fc88ac16d7f32a2f92c16c213622347178fcfce2a65ba67370a1477","personId":"69e50ad49c07587649d6ac60","name":"Schafstall Ethan Aymeric","email":"d.c.saymeric.26.uji07w@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.529Z"},{"year":2026,"hash":"d56ef1d82bd057ef08b8994e012d3d1f023c560dae059656f3b05613585f4816","personId":"69e50ad49c07587649d6ac59","name":"Rouwenhorst Timo Albert","email":"d.c.ralbert.26.1ahsn6@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.526Z"},{"year":2026,"hash":"25931a576e18023e85d25be406d4ebf7ea02249f2b7595575cb7132772de5fce","personId":"69e50ad49c07587649d6ac52","name":"Premat Luca André","email":"d.c.pandre.26.vs7uc2@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.524Z"},{"year":2026,"hash":"81ee6d57701b81c0e639caed72f0085b3e1bc52b14f20ee0455b69585d4bd2ee","personId":"69e50ad49c07587649d6ac4b","name":"Paramanathan Evin","email":"d.c.pevin.26.hthso3@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.521Z"},{"year":2026,"hash":"bc8a9d8ffc00af8b8f8000f7cdf953ddbf120382b3fa919786d8a90bac5d9d08","personId":"69e50ad49c07587649d6ac44","name":"Panzetta Vincent Lionel","email":"d.c.plionel.26.ob65wk@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.518Z"},{"year":2026,"hash":"70ed98066d5d3572c02d107d45dcfa758e189ea485b657df654337a0df079c4c","personId":"69e50ad39c07587649d6ac3d","name":"Napoleone Cyril Constant","email":"d.c.nconstant.26.mbch0r@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.515Z"},{"year":2026,"hash":"033a2fb57b9183eac495861148160acf56e6fb374f7fca4c3147dc1d3c58336a","personId":"69e5095f9c07587649d6ac1d","name":"Minger Thé","email":"d.c.mthe.26.y1hg1o@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.512Z"},{"year":2026,"hash":"7ded044fb57674922ac20d0de49f5ee43ba588fe7327c21e069ed2c81fd3d7b9","personId":"69e5093b9c07587649d6ac13","name":"Jotterand Timothy","email":"d.c.jtimothy.26.x5rjvk@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.510Z"},{"year":2026,"hash":"e34ba0ba7a1bb97b534f7a2febf83292ae856092f7ce9df81f79f7de7fc99473","personId":"69e4e15e10790eb80e9b4f65","name":"Carneiro Yohan","email":"carneiro.yohan@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.506Z"},{"year":2026,"hash":"f6c80fb49dd2872941f7fd7b05015404491f76b4c311b5c4e4ca380e367920f1","personId":"69e4e11f10790eb80e9b4f53","name":"Botteau Mathis","email":"botteau.mathis@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.503Z"},{"year":2026,"hash":"477100175eeb31c69924749fd63bbbbb45798a2981bb3a8a343d6ee7f0db41ba","personId":"69ddfbfae910b6872d05cb45","name":"Ristic Christopher","email":"ristic.christopher@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.499Z"},{"year":2026,"hash":"1bf338866b730f874cbe4fe63d4bbbf57fa851b8c71070efccb23af8bc3d6344","personId":"69ddfbfae910b6872d05cb30","name":"Gabriel Sauge","email":"gabriel.sauge@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.496Z"},{"year":2026,"hash":"327e66848adcd7d0974c82ab2407d2efff2b001d68d4b7dcb672a2a4b0eb07e8","personId":"69ddfbfae910b6872d05cb17","name":"Morier Mina","email":"morier.mina@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.493Z"},{"year":2026,"hash":"5c4fc2510ea2b4ec943cdbd2ee206788043be1c31b7270dd682b4be42c7b6af1","personId":"69ddfbfae910b6872d05cb02","name":"Skupovska Veronika","email":"skupovska.veronika@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.490Z"},{"year":2026,"hash":"91d5c74adff8d4024da1ab3d581bf1bd53c337ed1ccb58cfeb2f2993c9e6bb76","personId":"69ddfbfae910b6872d05caea","name":"Harun Findik","email":"d.c.hfindik.26.6o379o@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.486Z"},{"year":2026,"hash":"d56aa875d706b183b0a01f454a3b534e8df37721172440fb87cbbaa45adb81b5","personId":"69ddfbfae910b6872d05cadb","name":"Alain Girardet","email":"alain.girardet@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.483Z"},{"year":2026,"hash":"5e96ab17b5879cda81d935b6e2b6b6165d7d33d1b5dd393247a09c5668790c21","personId":"69ddfbfae910b6872d05cad2","name":"Essayas Meron","email":"d.c.emeron.26.drrw1f@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.480Z"},{"year":2026,"hash":"522f96efd71c1c9f71814bff615d77dff4d1beb036b4d055fadca995e847d392","personId":"69ddfbfae910b6872d05cabd","name":"Rodrigues Lopes Diogo Filipe","email":"rodrigues.lopesdiogofilipe@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.477Z"},{"year":2026,"hash":"2d98752f5c2b964b6c0a319dc29db588f10f1e7a80fbce7e084f1f228acb98d1","personId":"69ddfbfae910b6872d05caa8","name":"Grisales Betancur Jessica","email":"d.c.gbetancur.26.44ueau@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.473Z"},{"year":2026,"hash":"739f1d1ae78bc70542c6ff27fe76200ca640249433979cca2c85711aa314c2c6","personId":"69ddfbfae910b6872d05ca93","name":"Tecle Siem Biniam","email":"tecle.siembiniam@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.470Z"},{"year":2026,"hash":"021257ae94d95192295dbae0981001370f2068e111f222534125bb72ccfb0c35","personId":"69ddfbfae910b6872d05ca7e","name":"Denis Matias","email":"denis.matias@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.466Z"},{"year":2026,"hash":"85f5fbbd123839f44e821d421aca6bdfe4f5ffd65637e751447001c9abc1d483","personId":"69ddfbfae910b6872d05ca66","name":"Bartou Rayan","email":"bartou.rayan@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.463Z"},{"year":2026,"hash":"60ed3b5cf7fe6fe5ccb87a7a8b58ed96080363787eec4271a68b7068b1a69818","personId":"69ddfbfae910b6872d05ca4e","name":"Lopardo Alessio","email":"lopardo.alessio@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.459Z"},{"year":2026,"hash":"e5aab0c5dc1d8a4bc8441e1075e57aa702ac3759c2dffe64d0ab8812b4f1afa7","personId":"69ddfbfae910b6872d05ca39","name":"Wu Guoxu","email":"wu.guoxu@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.455Z"},{"year":2026,"hash":"61f854ca2f0e7db8079de51bfe6b1326447921253b2915e2535575c2bc098e81","personId":"69ddfbf9e910b6872d05ca24","name":"Pages Marius","email":"pages.marius@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.451Z"},{"year":2026,"hash":"9b2697df803bb4eb01fa4ae55efa3a0d648768003c96075f08895369f42c174e","personId":"69ddfbf9e910b6872d05ca0f","name":"Moser Even Gavrie","email":"moser.evengavrie@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.447Z"},{"year":2026,"hash":"0c4030f81ad98410a912d6abc633f99ce3c9f0731542ef4cc557ccb7e6767fb5","personId":"69ddfbf9e910b6872d05c9f7","name":"Gligorijevic Nikola","email":"d.c.gnikola.26.q3wie0@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.444Z"},{"year":2026,"hash":"01506bef8cf4288d6ef96b5acc6af1b9564874f4289374a0f8902b516f8ed52a","personId":"69ddfbf9e910b6872d05c9df","name":"Khalil Mateen Salem","email":"khalil.mateensalem@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.440Z"},{"year":2026,"hash":"35ece8cbf5959212d15764d087640ce132647174441953b4dda7ee8036b66f95","personId":"69ddfbf9e910b6872d05c9ca","name":"Mohamed Zarook Mohamed Zaahid","email":"mohamed.zarookmohamedzaahid@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.437Z"},{"year":2026,"hash":"c412e7a5032d89e525344b67297f4ce21b010bc139aa0efa76a68e3f20252b30","personId":"69ddfbf9e910b6872d05c9b5","name":"Almeida Sampaio Nelson Filipe","email":"almeida.sampaionelsonfilipe@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.433Z"},{"year":2026,"hash":"bd7278aded03b52772e4405b59a293691b1391846ecb04c7d3af80039ca83ace","personId":"69ddfbf9e910b6872d05c99a","name":"Velickovic Mateja","email":"velickovic.mateja@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.429Z"},{"year":2026,"hash":"07e2fb323e419b35ca40e4520313941e0942b7e03d5885433e410d6f76f2a82f","personId":"69ddfbf9e910b6872d05c985","name":"Metroz Quenti","email":"metroz.quenti@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.425Z"},{"year":2026,"hash":"5c644b0a08712f089f170925fa85949ea3c51e04d63e8c58fa8249b1019e2321","personId":"69ddfbf9e910b6872d05c970","name":"Belkhiria Sofiene Habib","email":"belkhiria.sofienehabib@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.421Z"},{"year":2026,"hash":"c1527976c7cac1e45a2082ad968885d38121a41d02f92b3353e6da17a8b5e681","personId":"69ddfbf9e910b6872d05c95b","name":"Al Hussein Mussa","email":"al.husseinmussa@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.417Z"},{"year":2026,"hash":"a222b940dd4a0a9bb26b2b027cbd992581cfdb3e034892cb52a78721acf20e7f","personId":"69ddfbf9e910b6872d05c946","name":"Mares Julien Pierre","email":"mares.julienpierre@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.413Z"},{"year":2026,"hash":"3049b669ee7b939096e1a485bf089db2c579c3c188fb834cb7472c85f3b6c472","personId":"69ddfbf9e910b6872d05c931","name":"Moia Luke","email":"moia.luke@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.409Z"},{"year":2026,"hash":"0261dc5b48781d28cb86aa1201e24806c4e0c4a621c82e2e3d41bf71f5e13f58","personId":"69ddfbf9e910b6872d05c91c","name":"Racine Thibaud","email":"racine.thibaud@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.405Z"},{"year":2026,"hash":"ac3f8418f5af27c3ba5765678ab7976fa2c5722305efaea17b195083ffde2d14","personId":"69ddfbf8e910b6872d05c907","name":"Nardou Thomas Louis","email":"nardou.thomaslouis@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.400Z"},{"year":2026,"hash":"0baab31d32d71e776489af7442c1f3b1083f9830cd26bbba150795b183567b9c","personId":"69ddfbf8e910b6872d05c8ef","name":"Rodrigues Sousa Tiago","email":"rodrigues.sousatiago@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.395Z"},{"year":2026,"hash":"3d18fb72ee6f1bfb28a0e66536fa373e863e260ff0267a3801c118e5f9649880","personId":"69ddfbf8e910b6872d05c8d7","name":"Lordon Lucas","email":"lordon.lucas@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.390Z"},{"year":2026,"hash":"aabaea29a1aacab0a9fbf202a77873484871fa1f2a8bd85ebb5104e308e9de7b","personId":"69ddfbf8e910b6872d05c8c2","name":"Roudet Alexy Julien","email":"roudet.alexyjulien@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.385Z"},{"year":2026,"hash":"ec4c02e85851b73397e4dc1252d86e24ef07cdddab15b78eb2093b1975c063e5","personId":"69ddfbf8e910b6872d05c8aa","name":"Amstutz Gabriele","email":"amstutz.gabriele@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.380Z"},{"year":2026,"hash":"e759b4eb0303298ad89857f1b2e69d8ee1c5e8a6ac748e7df4e54362bccfa609","personId":"69ddfbf8e910b6872d05c895","name":"Diezi Valentin","email":"diezi.valentin@tpiorganizer.ch","expiresAt":"2026-05-06T05:46:50.376Z"},{"year":2026,"hash":"13f7b358debf3b0b0b8e12088f4df9f46929baa8ffa9f23fb7193c0b205f0277","personId":"69dbc0c389ecf04f8410025f","name":"Bertrand Sahli","email":"bertrand.sahli@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.371Z"},{"year":2026,"hash":"d0cc12afaf9429a2f7c0d4a8a22cb625bef6e0662b03a9d2bc769dea908ad74d","personId":"69dbc07289ecf04f84100240","name":"Gael Sonney","email":"gael.sonney@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.367Z"},{"year":2026,"hash":"3f9aaf308abcdce827647ff937ae9bda3af454ea5ff3c732c06eee2f763c95ef","personId":"69dbc07289ecf04f8410023d","name":"Roberto Ferrari","email":"roberto.ferrari@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.363Z"},{"year":2026,"hash":"970df1aef49872faddbd04c7458f43ca7a136410c7b7edef82e49e127e169640","personId":"69dbc07289ecf04f8410023a","name":"Antoine Mveng Evina","email":"antoine.mveng@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.359Z"},{"year":2026,"hash":"e06278a05af7c3989329dce3d00a36f7722cf8f4a123dc2336d9e0431fc815ad","personId":"69dbc07289ecf04f84100237","name":"Pascal Piot","email":"pascal.piot@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.354Z"},{"year":2026,"hash":"44c74841b7d486b966bafe654894a479b7d8ca1c9a3ad7945fef8758e2f61203","personId":"69dbc07289ecf04f84100234","name":"Aurélie Curchod","email":"aurelie.curchod@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.350Z"},{"year":2026,"hash":"e653e8f39b41cecddde7fff9fca607761c7e37294b7a1dc57282f9be68cafbeb","personId":"69dbc07289ecf04f84100231","name":"Jonathan Melly","email":"jonathan.melly@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.345Z"},{"year":2026,"hash":"b2bb5e4af27f45e4b844cf6250498c0b274c9e9a156768dc975b02aa4a3cd619","personId":"69dbc07289ecf04f8410022c","name":"Xavier Carrel","email":"xavier.carrel@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.341Z"},{"year":2026,"hash":"c806aa018b3b350246996f5c1e660d75a749092e27ab732774f1f4a0a4f42cd2","personId":"69dbc07289ecf04f84100229","name":"Grégory Charmier","email":"gregory.charmier@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.337Z"},{"year":2026,"hash":"c5e490d852ce2b648419d546e9d45622f46ebea4098845f4046393686d62c032","personId":"69dbc07289ecf04f84100220","name":"Cédric Kind","email":"cedric.kind@paleo.ch","expiresAt":"2026-05-06T05:46:50.332Z"},{"year":2026,"hash":"ef00f609a161db1c5dad5b9aea1a676a41ff7f66705d51a778327098e1f24112","personId":"69dbc07289ecf04f8410021d","name":"Londero Maeva","email":"maeva.londero@epfl.ch","expiresAt":"2026-05-06T05:46:50.328Z"},{"year":2026,"hash":"0bc0d8848d8de9f6900e39bf37d06439d8b2417cdf4c44c212a800d38fa0ee44","personId":"69dbc07289ecf04f8410021a","name":"Romain Rosay","email":"romain.rosay@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.324Z"},{"year":2026,"hash":"1f48a2215761fcd93f461a69a8ecb96f9a4aebbbf991b85c6ca0434db1a57e3e","personId":"69dbc07289ecf04f84100217","name":"Guillaume Blanco","email":"guillaume.blanco@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.318Z"},{"year":2026,"hash":"95c3e229a77a7d82ca267fa77bdafd160127f0f58e151a5e8a98b17fba836a29","personId":"69dbc07289ecf04f84100212","name":"Laurent Duding","email":"laurent.duding@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.314Z"},{"year":2026,"hash":"e6baa08f246a407e93622c70c2ce6de993e2002f2218334eb15b858d72a1da72","personId":"69dbc07289ecf04f8410020f","name":"Patrick Chenaux","email":"patrick.chenaux@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.310Z"},{"year":2026,"hash":"2a3bfb6c0df99a8388fefa7e00816454ed57c37f61e2381fe43ba75765c068d5","personId":"69dbc07289ecf04f8410020c","name":"Cédric Schaffter","email":"cedric.schaffter@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.306Z"},{"year":2026,"hash":"b02a27ff271eef44c169e4cb85c65ae157b25c270c250880ba9f9bc768dda0e3","personId":"69dbc07289ecf04f84100206","name":"Mathieu Meylan","email":"mathieu.meylan@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.303Z"},{"year":2026,"hash":"2ca1133a5cbec4da6a30e78b74bc2676a3668293602ee3aa4bc8a65fdcd0c587","personId":"69dbc07289ecf04f84100203","name":"Dimitrios Lymberis","email":"dimitrios.lymberis@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.299Z"},{"year":2026,"hash":"48b8cacf6cfb63e0736d9d55e84c567fd6639f03b153c151aeac333fe99cd02f","personId":"69dbc07289ecf04f84100200","name":"Alain Garraux","email":"alain.garraux@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.295Z"},{"year":2026,"hash":"8f833ab02d0da5c95a3e2fc17a23e6beeb004e0018ff7aadf6ea6e3ed001ec54","personId":"69dbc07289ecf04f841001fd","name":"Sheyla Oliveira Kobi","email":"sheyla.oliveira@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.292Z"},{"year":2026,"hash":"ca1af96e43fce1dc09ab4e4f67275018dbc3bcde002662681e3b3248e7a7b444","personId":"69dbc07289ecf04f841001fa","name":"Helder Manuel Costa Lopes","email":"helder.costa@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.289Z"},{"year":2026,"hash":"dc6aad4382450025e893985ef10cd3a6be272bc857c0f45d27094bd690294646","personId":"69dbc07289ecf04f841001f7","name":"Isabelle Stucki","email":"isabelle.stucki@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.286Z"},{"year":2026,"hash":"fa70622f569f973073424436a233f5125494a61f32adb53fb4de4a660cd81f9b","personId":"69dbc07289ecf04f841001f4","name":"Alexis Gugler","email":"alexis.gugler@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.282Z"},{"year":2026,"hash":"3740d4390251babac67c391374bbc4aef69d1eea4090222f7f576d54b2896f51","personId":"69dbb567d9434724eaa11291","name":"Volkan Sutcu","email":"volkan.sutcu@hotmail.com","expiresAt":"2026-05-06T05:46:50.279Z"},{"year":2026,"hash":"1444371cca3d716c5edc40dcd6ec5cabc555f86f1e59531032671618eb034845","personId":"69dbb567d9434724eaa1128e","name":"Suleyman Ceran","email":"sueleyman.ceran@gmail.com","expiresAt":"2026-05-06T05:46:50.275Z"},{"year":2026,"hash":"1ee96c9af564a846010f9272e40808c609da9f64751bce2a6b292ed5dd5c63c1","personId":"69dbb567d9434724eaa1128b","name":"Sofia Roy","email":"sofia.roy@netzys.ch","expiresAt":"2026-05-06T05:46:50.270Z"},{"year":2026,"hash":"a8c791640bfd33a2cc5854fed077eae69fbeb1aee1f4ba4ee0f699ff97fdf203","personId":"69dbb567d9434724eaa11288","name":"Serge Wenger","email":"serge.wenger@matisa.ch","expiresAt":"2026-05-06T05:46:50.266Z"},{"year":2026,"hash":"7a2f924368aa366c42e30f33bd5fd9cef3ffab2870d03cf55d1e52a9f5f419e9","personId":"69dbb567d9434724eaa11282","name":"Raphaël Favre","email":"raphael.favre@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.263Z"},{"year":2026,"hash":"30f28039437158f5606436373cd90c7d21d1d0fae14b570a5c20e2691d49b5ae","personId":"69dbb567d9434724eaa1127f","name":"Pascal Benzonana","email":"pascal.benzonana@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.260Z"},{"year":2026,"hash":"ca331ac54c1e055e9607095ad1672d99ad37d0df23f620bfd80bcf71ad773b80","personId":"69dbb567d9434724eaa1127c","name":"Olivier Mellina","email":"mellina.olivier@gmail.com","expiresAt":"2026-05-06T05:46:50.257Z"},{"year":2026,"hash":"ba750a0c907b12f187a4f5e3e4a9614c6c97c9942b6bdcd9704e8e55421aff0f","personId":"69dbb567d9434724eaa11279","name":"Nicolas Borboën","email":"nicolas.borboen@epfl.ch","expiresAt":"2026-05-06T05:46:50.254Z"},{"year":2026,"hash":"9e8a78a52cc842ad1f3a95cdcab2339374b0e247c603e4e22476f1bb1264de6e","personId":"69dbb567d9434724eaa11276","name":"Mikael Gonzalez","email":"mikael.gonzalez7@gmail.com","expiresAt":"2026-05-06T05:46:50.251Z"},{"year":2026,"hash":"c9c53f9ded534de1182860b0523338f42dbb59a8334a4eec5a61008902160b2b","personId":"69dbb567d9434724eaa11273","name":"Michel Ange Delgado","email":"michel.delgado@bluewin.ch","expiresAt":"2026-05-06T05:46:50.247Z"},{"year":2026,"hash":"3ab30dbac9cf256cb8d2d6431313abe762580afb1e66f69c442018af694bb248","personId":"69dbb567d9434724eaa11270","name":"Michael Wyssa","email":"michael.wyssa@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.243Z"},{"year":2026,"hash":"92fee8627e2e3039cd0bb6407fae9391e59b38c7a9b4784e4de8099b8890d41b","personId":"69dbb567d9434724eaa1126d","name":"Max Roy","email":"max.roy@netzys.ch","expiresAt":"2026-05-06T05:46:50.240Z"},{"year":2026,"hash":"1f9d2721aa64ab0221e34be47125d4a83e06e8e75dd4e5c1586720f4d1f6e2c5","personId":"69dbb567d9434724eaa11267","name":"Mathias Giroud","email":"giroud@cinformatique.ch","expiresAt":"2026-05-06T05:46:50.236Z"},{"year":2026,"hash":"20e0c47005dab988a11622924950d84fd336e7c324a5103fdd40cfcd53310e5d","personId":"69dbb567d9434724eaa11264","name":"Luc Venries","email":"luc.venries@epfl.ch","expiresAt":"2026-05-06T05:46:50.232Z"},{"year":2026,"hash":"9bb1a996585e86e9c7a5d3ac8e57d602f54f565c1d7b6b4e8e5e31613c5db03e","personId":"69dbb567d9434724eaa11261","name":"Karim Bourahla","email":"karim.bourahla@eduvaud.ch","expiresAt":"2026-05-06T05:46:50.228Z"},{"year":2026,"hash":"ef06ef1366e200ebe2b33ba2854009d22bb79163d855c81e375fe90ceeac9fca","personId":"69dbb567d9434724eaa1125e","name":"Jean-Luc Roduit","email":"dedecop2@gmail.com","expiresAt":"2026-05-06T05:46:50.224Z"},{"year":2026,"hash":"93a0bb00a98f1e340f6cd1576b11e457ad05fec14646f1d95be1b5ef6b0652c0","personId":"69dbb567d9434724eaa1125b","name":"Jason Crisante","email":"jasoncrisantepro@outlook.com","expiresAt":"2026-05-06T05:46:50.221Z"},{"year":2026,"hash":"8000c65c235cc8b123ddef8d026ff3795c3a3bb09868800c76e16c473fe4c70d","personId":"69dbb567d9434724eaa11258","name":"Gabriel Maret","email":"gab.maret@gmail.com","expiresAt":"2026-05-06T05:46:50.215Z"},{"year":2026,"hash":"25b1f1d381e1a470b4a835777b15ade1865283c539288b54c2b7097c5f40579a","personId":"69dbb567d9434724eaa11252","name":"Ernesto Montemayor","email":"ernesto@bati-technologie.ch","expiresAt":"2026-05-06T05:46:50.211Z"},{"year":2026,"hash":"1b3cbe9c962b008f952babb876b433aa0e402fbe62142eef6785594b2842211e","personId":"69dbb567d9434724eaa1124f","name":"Diego Criscenti","email":"diego.criscenti@hepl.ch","expiresAt":"2026-05-06T05:46:50.207Z"},{"year":2026,"hash":"0415795c34fbfe51ecf2b5f1d07c1bd65893fabf4b1d93c483c32615f916ca9f","personId":"69dbb567d9434724eaa1124c","name":"Daniel Berney","email":"daniel.berney@heig-vd.ch","expiresAt":"2026-05-06T05:46:50.202Z"},{"year":2026,"hash":"cc0f5c5611400a5179e533f33e50adc67e9e7ac63329db0c5ea94794a81f487b","personId":"69dbb567d9434724eaa11249","name":"Claude-Albert Muller Theurillat","email":"expertclaude65@gmail.com","expiresAt":"2026-05-06T05:46:50.198Z"},{"year":2026,"hash":"e46b0ea5df2cb673067fdb53099c880aef1a797bf9834a8c3765950e60302122","personId":"69dbb567d9434724eaa11246","name":"Carlos Perez","email":"carlos.perez@epfl.ch","expiresAt":"2026-05-06T05:46:50.191Z"},{"year":2026,"hash":"12bcbb0702161c79c4443d22fc0451566d9756e99d297f714caf31db4bb40d8a","personId":"69dbb567d9434724eaa11240","name":"Bernard Oberson","email":"oberson.bernard@gmail.com","expiresAt":"2026-05-06T05:46:50.186Z"},{"year":2026,"hash":"65483f6978401b5597d9210d80ecf3aa94b359a52a7ff3bc2fef6f571f246cb5","personId":"69dbb567d9434724eaa1123d","name":"Arnaud Sartoni","email":"arnaud.sartoni@epfl.ch","expiresAt":"2026-05-06T05:46:50.182Z"},{"year":2026,"hash":"211ba6bc3e8943f0a6385fbaa6518b96589683912fb59fb58d7671214603dcb3","personId":"69dbb567d9434724eaa1123a","name":"Alexandre Graf","email":"alg@web-services.com","expiresAt":"2026-05-06T05:46:50.177Z"},{"year":2026,"hash":"f60848060280ebb5a0af8fdbee8ab2299c5bf72868de76add152043cbae245b7","personId":"69dbb567d9434724eaa11237","name":"Alain Pittet","email":"alain.pittet@info-domo.ch","expiresAt":"2026-05-06T05:46:50.157Z"},{"year":2026,"hash":"c9cb243784f6934c8cb1688ce22f7ef0f85bf387857d421238c99c748aad355e","personId":"69ddfbf8e910b6872d05c8c2","name":"Roudet Alexy Julien","email":"roudet.alexyjulien@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.177Z"},{"year":2026,"hash":"792c62080829c028f5971a2282eaee712801a7128704d30b930c907cd3f100cd","personId":"69dbb567d9434724eaa11276","name":"Mikael Gonzalez","email":"mikael.gonzalez7@gmail.com","expiresAt":"2026-05-05T13:24:53.172Z"},{"year":2026,"hash":"3009d5668d347170bac67fcaee5ddcb3df2a3c85210243be088f748feebd68cb","personId":"69ddfbf8e910b6872d05c8d7","name":"Lordon Lucas","email":"lordon.lucas@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.168Z"},{"year":2026,"hash":"a3c752e9ca40119af3278d8560b48a0548e054d3d621222630ae8367e15a098c","personId":"69ddfbf8e910b6872d05c8ef","name":"Rodrigues Sousa Tiago","email":"rodrigues.sousatiago@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.164Z"},{"year":2026,"hash":"cbf0bdb2ef2f6258b7df434e58e6cd66937caa032e88b330b048d3c9bcd44bfd","personId":"69e60b5412f10335dc69cbf5","name":"Laurent Deschamps","email":"laurent.deschamps@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.160Z"},{"year":2026,"hash":"04070e5c30d7f69e695c7f0bb117805e68d728b3b72f505eeb693b886a9ef244","personId":"69dbb567d9434724eaa11237","name":"Alain Pittet","email":"alain.pittet@info-domo.ch","expiresAt":"2026-05-05T13:24:53.155Z"},{"year":2026,"hash":"8f5dedffab4665d9f106ce34164d5830cc0752d2c808a7f24c5c789d90da48c5","personId":"69ddfbfae910b6872d05cb02","name":"Skupovska Veronika","email":"skupovska.veronika@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.151Z"},{"year":2026,"hash":"cabb7aa0d71a3f07ba120715e9c6b451e0385f4fe0814883062f0bbe85f2e2e3","personId":"69ddfbf9e910b6872d05c970","name":"Belkhiria Sofiene Habib","email":"belkhiria.sofienehabib@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.146Z"},{"year":2026,"hash":"e01d6cf52a977f4bf0a091c3f7fb2ed67e7a17037d7522f832e07f83138c3506","personId":"69dbc07289ecf04f8410021d","name":"Londero Maeva","email":"maeva.londero@epfl.ch","expiresAt":"2026-05-05T13:24:53.142Z"},{"year":2026,"hash":"2f8b9f8a7297ab1106625676d14d09261a01d377773fe04ddb9439cc7282e7e7","personId":"69dbc0c389ecf04f8410025f","name":"Bertrand Sahli","email":"bertrand.sahli@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.138Z"},{"year":2026,"hash":"7c8202061a366561ab81c743a0675f2d72803e6795343fa56e8f33bf6227e2f8","personId":"69dbb567d9434724eaa1127c","name":"Olivier Mellina","email":"mellina.olivier@gmail.com","expiresAt":"2026-05-05T13:24:53.134Z"},{"year":2026,"hash":"ae90eb16901976cc4e38dbfbb879dbea83bd2c54fe7ed6e70e08a9d568398c11","personId":"69e4e15e10790eb80e9b4f65","name":"Carneiro Yohan","email":"carneiro.yohan@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.130Z"},{"year":2026,"hash":"956ad4ddd9d060bf08f3c2761e3bc26dade30771a9cee4c15af1ddb035365b29","personId":"69dbc07289ecf04f8410023d","name":"Roberto Ferrari","email":"roberto.ferrari@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.125Z"},{"year":2026,"hash":"fc9175cb2664598dd72d19c3a2e9f800a8d71d00de5e8d0f2d7e3e1bdd81f817","personId":"69ddfbf9e910b6872d05c91c","name":"Racine Thibaud","email":"racine.thibaud@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.120Z"},{"year":2026,"hash":"700673782e291a293a85220b3b5046bd39f5581e818c4ab89e3df3d1a85f8ae7","personId":"69dbc07289ecf04f8410020c","name":"Cédric Schaffter","email":"cedric.schaffter@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.117Z"},{"year":2026,"hash":"ee906c3e4e284821436b074782e66ec010f657c6241e815decff9fda5aacdffb","personId":"69dbb567d9434724eaa11240","name":"Bernard Oberson","email":"oberson.bernard@gmail.com","expiresAt":"2026-05-05T13:24:53.114Z"},{"year":2026,"hash":"d4173abce8946a02cc3b4ac0f4ab8ebae037a0fa0a1a180e95eb7d311d9f2afb","personId":"69ddfbf9e910b6872d05c9b5","name":"Almeida Sampaio Nelson Filipe","email":"almeida.sampaionelsonfilipe@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.110Z"},{"year":2026,"hash":"54a7977ef9d261b7c171538b235154a8e859fcc7ebd1ca52b436860334cb5b31","personId":"69e754332ccbf98274ca0810","name":"Albert Richard","email":"albert.richard@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.105Z"},{"year":2026,"hash":"f32a1fe2cf7580d1b15c2c8e28f3ced6d37a2cf18dffca81fbfba8b4eb4e0f25","personId":"69dbc07289ecf04f8410020f","name":"Patrick Chenaux","email":"patrick.chenaux@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.101Z"},{"year":2026,"hash":"89d5e0a68cd84f8071b18ef1faac8c476100c49e3c354f97b17ef8a830de9ce7","personId":"69ddfbfae910b6872d05ca7e","name":"Denis Matias","email":"denis.matias@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.097Z"},{"year":2026,"hash":"f165da7dc0ae77be958e139d2dd58e8e49faedbabd7c9bf79bec352388bf96e3","personId":"69dbc07289ecf04f84100212","name":"Laurent Duding","email":"laurent.duding@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.092Z"},{"year":2026,"hash":"c5e0d280dff87d728d27f227055ad31b52005b0c95c1d42987b606034906129e","personId":"69ddfbf9e910b6872d05c9ca","name":"Mohamed Zarook Mohamed Zaahid","email":"mohamed.zarookmohamedzaahid@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.088Z"},{"year":2026,"hash":"fedc1362cd9e037cfcd6ab3febc100bc301120d6a2e83855a2b056f02653f2be","personId":"69dbc07289ecf04f84100220","name":"Cédric Kind","email":"cedric.kind@paleo.ch","expiresAt":"2026-05-05T13:24:53.083Z"},{"year":2026,"hash":"aef52f607366e5337934cfd7d7e9305c90d8198ae51eb59133fe8e248b3c66c9","personId":"69ddfbfae910b6872d05cb17","name":"Morier Mina","email":"morier.mina@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.079Z"},{"year":2026,"hash":"5cf29feb03d3c88cb22b158a92cf97439cbed35c87ef68590092f127864d6aad","personId":"69dbc07289ecf04f84100217","name":"Guillaume Blanco","email":"guillaume.blanco@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.075Z"},{"year":2026,"hash":"9356c0a2fe0751b1678d5ded5f8500640c26a24da15a88f4b9ed64dc60993302","personId":"69ddfbf9e910b6872d05c95b","name":"Al Hussein Mussa","email":"al.husseinmussa@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.070Z"},{"year":2026,"hash":"902aa068e72838f832084902c8ba68594420ab61a2633c01d662e192c8dc4b4f","personId":"69dbc07289ecf04f84100206","name":"Mathieu Meylan","email":"mathieu.meylan@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.066Z"},{"year":2026,"hash":"a543136febe11e2e46ba4d2e44496c558b9b4b04bb081ce513c7a084f5176fac","personId":"69dbb567d9434724eaa11258","name":"Gabriel Maret","email":"gab.maret@gmail.com","expiresAt":"2026-05-05T13:24:53.061Z"},{"year":2026,"hash":"ea2cb3bc2f43b61ec8455a49c5c6287a9ca3cd38fe10bec808571ee7db0268f3","personId":"69ddfbf9e910b6872d05c99a","name":"Velickovic Mateja","email":"velickovic.mateja@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.056Z"},{"year":2026,"hash":"8c84804bb774eb9a63e7f44560e11659d146fc492309a0f4a159043e271db91d","personId":"69dbc07289ecf04f841001f4","name":"Alexis Gugler","email":"alexis.gugler@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.052Z"},{"year":2026,"hash":"e67813427463a01f0e7b7470a70498f6fce8b2cee18e4cc8859b8fca63fa670f","personId":"69ddfbfae910b6872d05ca93","name":"Tecle Siem Biniam","email":"tecle.siembiniam@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.047Z"},{"year":2026,"hash":"530884f8edd4dd49ef9a4f628194989e7b64b343027cc43d74fc7af644c87611","personId":"69dbb567d9434724eaa1126d","name":"Max Roy","email":"max.roy@netzys.ch","expiresAt":"2026-05-05T13:24:53.043Z"},{"year":2026,"hash":"74067e7bd8008117643db4d2705280cd6e8ac70ef910d71656e0ac4c5214b25f","personId":"69dbb567d9434724eaa1123d","name":"Arnaud Sartoni","email":"arnaud.sartoni@epfl.ch","expiresAt":"2026-05-05T13:24:53.038Z"},{"year":2026,"hash":"175dd44d6b5209cba575f43796832c5b09576618941dc90f7c70f14cf8e5299a","personId":"69ddfbf9e910b6872d05ca0f","name":"Moser Even Gavrie","email":"moser.evengavrie@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.034Z"},{"year":2026,"hash":"167ff7520c3bab7432cc9bb7d604c9a37a53ec120a1efeb7ced96d14d3ad627c","personId":"69dbc07289ecf04f841001fd","name":"Sheyla Oliveira Kobi","email":"sheyla.oliveira@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.029Z"},{"year":2026,"hash":"fbf450debc306ac2ffcba956d2a24b716dcf5055084552f3690b7b8b0108c89e","personId":"69ddfbfae910b6872d05ca39","name":"Wu Guoxu","email":"wu.guoxu@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.025Z"},{"year":2026,"hash":"faa3fce48aee02296ac5332665bcd519a67eb779ccf5c4742e90200ad30b1d3d","personId":"69dbb567d9434724eaa11282","name":"Raphaël Favre","email":"raphael.favre@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.021Z"},{"year":2026,"hash":"75f92bbdb51b3aa496713182b34a6243cb692d9e15e6bcb36bad4aece2df06e6","personId":"69dbb567d9434724eaa1123a","name":"Alexandre Graf","email":"alg@web-services.com","expiresAt":"2026-05-05T13:24:53.018Z"},{"year":2026,"hash":"85d7a60ffe58e18546c37a4287019991351edcf1781e17505f430a14056e1eb4","personId":"69ddfbfae910b6872d05cb45","name":"Ristic Christopher","email":"ristic.christopher@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.016Z"},{"year":2026,"hash":"b90d573c5a3c215d36b7cbd9e2add4467e3f4d71689cf8c7f237ba51344eeae6","personId":"69dbb567d9434724eaa1125e","name":"Jean-Luc Roduit","email":"dedecop2@gmail.com","expiresAt":"2026-05-05T13:24:53.013Z"},{"year":2026,"hash":"79860b93a8a29b8dfb0aa4004aec9b54a52d32c74d85160871810a5650d5093f","personId":"69ddfbf9e910b6872d05ca24","name":"Pages Marius","email":"pages.marius@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:53.009Z"},{"year":2026,"hash":"fc739af54464516a4520fd2fc38a56e47311c52a50a1e5a9a8a61c65f10a4cee","personId":"69ddfbfae910b6872d05cadb","name":"Alain Girardet","email":"alain.girardet@eduvaud.ch","expiresAt":"2026-05-05T13:24:53.004Z"},{"year":2026,"hash":"7926ba87524860e9c2c75afce85760c99773fdf32af075a316de66c0553f80a8","personId":"69dbb567d9434724eaa1128e","name":"Suleyman Ceran","email":"sueleyman.ceran@gmail.com","expiresAt":"2026-05-05T13:24:53.001Z"},{"year":2026,"hash":"5d93afbe0c961109a0d094367c6fbb7f11a0fea619142e7fa63f09d618f2dedf","personId":"69ddfbf9e910b6872d05c946","name":"Mares Julien Pierre","email":"mares.julienpierre@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.996Z"},{"year":2026,"hash":"0a6c39fbccd0417331c6bde5d03673ce21a5e8be1170c2e428b606e074d662f8","personId":"69ddfbf9e910b6872d05c931","name":"Moia Luke","email":"moia.luke@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.992Z"},{"year":2026,"hash":"bfdb50c7b27e35bff56478407238745020982211907da6a1ede900145f871e68","personId":"69dbc07289ecf04f841001fa","name":"Helder Manuel Costa Lopes","email":"helder.costa@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.989Z"},{"year":2026,"hash":"94584198c0ae9daa6123696ff6b12b9a6e6808a1d05d1215313a51300a40f5e5","personId":"69dbc07289ecf04f8410023a","name":"Antoine Mveng Evina","email":"antoine.mveng@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.986Z"},{"year":2026,"hash":"fc1ab546982325e8765ab8bee06f7c98d8565e494d99f8ba5dee8e518a763509","personId":"69dbb567d9434724eaa1128b","name":"Sofia Roy","email":"sofia.roy@netzys.ch","expiresAt":"2026-05-05T13:24:52.982Z"},{"year":2026,"hash":"00bf25b6a877e64c27e979bb13b20bda3469b51343c9fee7f05c2112d03554a4","personId":"69ddfbf9e910b6872d05c9df","name":"Khalil Mateen Salem","email":"khalil.mateensalem@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.977Z"},{"year":2026,"hash":"0c451f26a0dfbc6921843ce0a46efa1bd7286db45a37a48ff04b82a14dcfcc8a","personId":"69dbc07289ecf04f84100229","name":"Grégory Charmier","email":"gregory.charmier@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.973Z"},{"year":2026,"hash":"9d5a118decce38ccb1529ec4aaec697233898aca19a50cb9734a128126f20b63","personId":"69ddfbfae910b6872d05ca4e","name":"Lopardo Alessio","email":"lopardo.alessio@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.970Z"},{"year":2026,"hash":"6014cb93849b9a7064c1cd2cba594db86147aab8cf14231036121f3d2171d1b5","personId":"69dbc07289ecf04f84100203","name":"Dimitrios Lymberis","email":"dimitrios.lymberis@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.966Z"},{"year":2026,"hash":"7795de7e1f232767e80aae18fed9a4056bbc4f2cef5e43eb3312e85d9bbb4c09","personId":"69dbb567d9434724eaa1124f","name":"Diego Criscenti","email":"diego.criscenti@hepl.ch","expiresAt":"2026-05-05T13:24:52.962Z"},{"year":2026,"hash":"306580139c210a1d08fd677b86a080882118deb6d30c21efed54198d6477e9f3","personId":"69dbb567d9434724eaa11264","name":"Luc Venries","email":"luc.venries@epfl.ch","expiresAt":"2026-05-05T13:24:52.958Z"},{"year":2026,"hash":"10173f4a61ee1730ed90fceb83517db16441b30843a8783099b3130d4abda31b","personId":"69ddfbf9e910b6872d05c985","name":"Metroz Quenti","email":"metroz.quenti@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.955Z"},{"year":2026,"hash":"7a27ee6dcdb55619d1419c815cfaf6edbd3d04169701f1a17623fb31a882382b","personId":"69dbb567d9434724eaa11291","name":"Volkan Sutcu","email":"volkan.sutcu@hotmail.com","expiresAt":"2026-05-05T13:24:52.952Z"},{"year":2026,"hash":"d6bec843541576922bb3bdb7e20721596052f5139ec0617acdfef3349359844c","personId":"69ddfbfae910b6872d05cabd","name":"Rodrigues Lopes Diogo Filipe","email":"rodrigues.lopesdiogofilipe@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.950Z"},{"year":2026,"hash":"bf995f1c19820be8fa9ea26b400cca2898cbfedce460b1f0ee9c849a01e4afb2","personId":"69dbc07289ecf04f84100200","name":"Alain Garraux","email":"alain.garraux@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.946Z"},{"year":2026,"hash":"3e29db3e797d35ffe71f74ed885b65e2c0afd66d676df66289dfab26834c3370","personId":"69dbc07289ecf04f8410022c","name":"Xavier Carrel","email":"xavier.carrel@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.942Z"},{"year":2026,"hash":"cae12c8b6bdc248eed9e05ebc5660fd0d8cff60f21e8274b05cb205173a54fb4","personId":"69dbc07289ecf04f84100237","name":"Pascal Piot","email":"pascal.piot@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.938Z"},{"year":2026,"hash":"5f5e776d3ac327556352b9f9594e1f282dc6d1cd0ecfe3d70a1bfb17585d49d9","personId":"69dbb567d9434724eaa11252","name":"Ernesto Montemayor","email":"ernesto@bati-technologie.ch","expiresAt":"2026-05-05T13:24:52.935Z"},{"year":2026,"hash":"4fdc82a9be40c75f44c5f8f9847dbb80aa85569a3bf2bede121b12a4fd6d5e6c","personId":"69dbc07289ecf04f8410021a","name":"Romain Rosay","email":"romain.rosay@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.932Z"},{"year":2026,"hash":"826012e3e39b54de4744ead7295412c5bfab51895daadba74eb04f296d9a22a0","personId":"69dbb567d9434724eaa11249","name":"Claude-Albert Muller Theurillat","email":"expertclaude65@gmail.com","expiresAt":"2026-05-05T13:24:52.928Z"},{"year":2026,"hash":"d04e1f7cf2a715df90c333b38fefd55e6893d0a17ee1165c9225ad7c1f531efb","personId":"69dbc07289ecf04f84100240","name":"Gael Sonney","email":"gael.sonney@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.923Z"},{"year":2026,"hash":"8e523656ae3243c0356e242d9729758e6ed4996bb9e2e0f5f4922e26f01a4764","personId":"69e609d712f10335dc69cb3c","name":"Nemanja Pantic","email":"nemo.pantic@gmail.com","expiresAt":"2026-05-05T13:24:52.921Z"},{"year":2026,"hash":"d1a3dcc14ce9d3dc2ad052e2ac08943a9e962bf4b2fc0b5306b71d8e936c199b","personId":"69dbb567d9434724eaa11267","name":"Mathias Giroud","email":"giroud@cinformatique.ch","expiresAt":"2026-05-05T13:24:52.918Z"},{"year":2026,"hash":"1b3e274cda57d0ef2c833ae472132c03d0f2cdcc27705b9425811d9766b59a27","personId":"69dbb567d9434724eaa11279","name":"Nicolas Borboën","email":"nicolas.borboen@epfl.ch","expiresAt":"2026-05-05T13:24:52.914Z"},{"year":2026,"hash":"f285048fda82c4e93d72353f2a38cde28f70db270bbc2aec58a65604a04d1737","personId":"69ddfbf8e910b6872d05c907","name":"Nardou Thomas Louis","email":"nardou.thomaslouis@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.910Z"},{"year":2026,"hash":"6980bf100c2494ed6813eb8ad8dd09e34431e24a4ba396d660125252dcca87ee","personId":"69dbc07289ecf04f84100231","name":"Jonathan Melly","email":"jonathan.melly@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.906Z"},{"year":2026,"hash":"52213e726b58e69803c8139bf4691f376f58f30aaae8b06c8b55f140169538d1","personId":"69dbb567d9434724eaa11270","name":"Michael Wyssa","email":"michael.wyssa@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.903Z"},{"year":2026,"hash":"4d0048d2e2c624b677aad180a3ee5afef2c195036cdccc0255b5cf198f9d1209","personId":"69dbb567d9434724eaa11288","name":"Serge Wenger","email":"serge.wenger@matisa.ch","expiresAt":"2026-05-05T13:24:52.899Z"},{"year":2026,"hash":"7e405fd0df9e89ecf6a31282868820fffec5104fb966d04f0b72d313369828b4","personId":"69dbc07289ecf04f84100234","name":"Aurélie Curchod","email":"aurelie.curchod@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.895Z"},{"year":2026,"hash":"fb6ce9db1900d661d0f5e19aab1fb71ae71caf2865b3c77b911ca9c2478fb2f7","personId":"69dbb567d9434724eaa1127f","name":"Pascal Benzonana","email":"pascal.benzonana@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.890Z"},{"year":2026,"hash":"e2b40a0ac9d79abd0ef6aabe6b729c275ba8256c27d62e6464a96a7d3085624d","personId":"69dbc07289ecf04f841001f7","name":"Isabelle Stucki","email":"isabelle.stucki@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.886Z"},{"year":2026,"hash":"57b7a2612d3231d11c90f43361e950a25cabe443940f85677c97d0460015cbc9","personId":"69dbb567d9434724eaa1125b","name":"Jason Crisante","email":"jasoncrisantepro@outlook.com","expiresAt":"2026-05-05T13:24:52.883Z"},{"year":2026,"hash":"a4ce9b1e94f3edefdf88a2e04298c46bd7832310bdde9fc4ede51a6a34c95d51","personId":"69dbb567d9434724eaa1124c","name":"Daniel Berney","email":"daniel.berney@heig-vd.ch","expiresAt":"2026-05-05T13:24:52.877Z"},{"year":2026,"hash":"579ab9fe82136cafddf9c387629f9395e8286401c9d78cc78c0964aa1d54223e","personId":"69ddfbf8e910b6872d05c895","name":"Diezi Valentin","email":"diezi.valentin@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.873Z"},{"year":2026,"hash":"700477062f4039d0ab7f7adb94649e9184d5fae42f9b1966509b2b113caa6427","personId":"69dbb567d9434724eaa11261","name":"Karim Bourahla","email":"karim.bourahla@eduvaud.ch","expiresAt":"2026-05-05T13:24:52.869Z"},{"year":2026,"hash":"9ad4c317f68b524fdb5aa5807eb356be0a7321d6594a619e4db27fb17d868a5f","personId":"69dbb567d9434724eaa11273","name":"Michel Ange Delgado","email":"michel.delgado@bluewin.ch","expiresAt":"2026-05-05T13:24:52.866Z"},{"year":2026,"hash":"1a6efcc0dbb644f64e991b1b783c0e0cf058738e110bb4cbc721e2b395176179","personId":"69dbb567d9434724eaa11246","name":"Carlos Perez","email":"carlos.perez@epfl.ch","expiresAt":"2026-05-05T13:24:52.862Z"},{"year":2026,"hash":"4edd719535a36422262ae7516975ddfd5829630fd88d2a202f2386b8b958b14d","personId":"69ddfbf8e910b6872d05c8aa","name":"Amstutz Gabriele","email":"amstutz.gabriele@tpiorganizer.ch","expiresAt":"2026-05-05T13:24:52.828Z"},{"year":2026,"hash":"3e93c0f2e7f045e908da1ec20e9bf7d7bf22a7514a90111f8caa836ff2806d20","personId":"69ddfbf8e910b6872d05c8c2","name":"Roudet Alexy Julien","email":"roudet.alexyjulien@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.918Z"},{"year":2026,"hash":"61ff24c488673a56cd3a0a06fd394f8b9458312f09835f3bec5947b4ff6a91d9","personId":"69dbb567d9434724eaa11276","name":"Mikael Gonzalez","email":"mikael.gonzalez7@gmail.com","expiresAt":"2026-05-05T11:48:17.914Z"},{"year":2026,"hash":"3cf201538a1477f04282157d71d247ac4f8d5e7998129e77f0ca713c15d15c7b","personId":"69ddfbf8e910b6872d05c8d7","name":"Lordon Lucas","email":"lordon.lucas@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.910Z"},{"year":2026,"hash":"9a7383112ad2a042cde047c82a78987e0d827b8d4388fea393f9beadb6f7b846","personId":"69ddfbf8e910b6872d05c8ef","name":"Rodrigues Sousa Tiago","email":"rodrigues.sousatiago@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.905Z"},{"year":2026,"hash":"e3e9e99e4415bdbbf58945b77e647e22881bb989f20a54405de470189d0a6d3a","personId":"69e60b5412f10335dc69cbf5","name":"Laurent Deschamps","email":"laurent.deschamps@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.901Z"},{"year":2026,"hash":"bd4a258527c3af12336d59092ad7c8431353c186e93fe089f675656d18bdf006","personId":"69dbb567d9434724eaa11237","name":"Alain Pittet","email":"alain.pittet@info-domo.ch","expiresAt":"2026-05-05T11:48:17.896Z"},{"year":2026,"hash":"ee6502e7ff200568ff452159265e2ec02894a853cabb1af29fa52e6f71d7bd06","personId":"69ddfbfae910b6872d05cb02","name":"Skupovska Veronika","email":"skupovska.veronika@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.891Z"},{"year":2026,"hash":"fdb9884278f64bd2aaacf0257c081bde99e8669a61cada4c301cb71046a90e28","personId":"69ddfbf9e910b6872d05c970","name":"Belkhiria Sofiene Habib","email":"belkhiria.sofienehabib@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.886Z"},{"year":2026,"hash":"17d80cd11261a335e2b88d289a0735313d6bc6d6652598e0b821f8603641e62b","personId":"69dbc07289ecf04f8410021d","name":"Londero Maeva","email":"maeva.londero@epfl.ch","expiresAt":"2026-05-05T11:48:17.881Z"},{"year":2026,"hash":"760450f76afa34d361b72bf42c5d7f01f78d6f66fda0c5418cea71efe228c0d5","personId":"69dbc0c389ecf04f8410025f","name":"Bertrand Sahli","email":"bertrand.sahli@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.876Z"},{"year":2026,"hash":"bcd8df785a1a0e0adcfa6ad0ac6b889666b51ab2a995c32e1833524db0da0298","personId":"69dbb567d9434724eaa1127c","name":"Olivier Mellina","email":"mellina.olivier@gmail.com","expiresAt":"2026-05-05T11:48:17.872Z"},{"year":2026,"hash":"461efe48da9044a45f9ef8743309f5aef5bf6b22054596171eeec6aa913619f9","personId":"69e4e15e10790eb80e9b4f65","name":"Carneiro Yohan","email":"carneiro.yohan@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.867Z"},{"year":2026,"hash":"99d89e64e9343addc88b8808608f86917e8dd4b4823c391479c6392f5e655e8f","personId":"69dbc07289ecf04f8410023d","name":"Roberto Ferrari","email":"roberto.ferrari@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.862Z"},{"year":2026,"hash":"59d05ee1a6279dd2ed84e3c2130c2ad2844116d10d5851abe853f6dff01fad76","personId":"69ddfbf9e910b6872d05c91c","name":"Racine Thibaud","email":"racine.thibaud@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.857Z"},{"year":2026,"hash":"e1aa2824942e6f8cb9ea4a9ab02cfeda6f3a9c06e2779175e6b002cfe587653c","personId":"69dbc07289ecf04f8410020c","name":"Cédric Schaffter","email":"cedric.schaffter@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.852Z"},{"year":2026,"hash":"55d6efe44eb0edc439405a8537e5cd897ad44d2ee9443f77693219396b667da8","personId":"69dbb567d9434724eaa11240","name":"Bernard Oberson","email":"oberson.bernard@gmail.com","expiresAt":"2026-05-05T11:48:17.848Z"},{"year":2026,"hash":"defe0476dac3ca98777f8e81c68e31fecf1b78cf95fbfb4d2101a1a21fc64704","personId":"69ddfbf9e910b6872d05c9b5","name":"Almeida Sampaio Nelson Filipe","email":"almeida.sampaionelsonfilipe@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.843Z"},{"year":2026,"hash":"b5dce2192a207800be41d3c573e475a64568fbe234874c5a1194615d7701e089","personId":"69e754332ccbf98274ca0810","name":"Albert Richard","email":"albert.richard@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.839Z"},{"year":2026,"hash":"d740b75c1603381aa4fe31d011b4e8170d617b9eeaa719caca8ef780f64079f5","personId":"69dbc07289ecf04f8410020f","name":"Patrick Chenaux","email":"patrick.chenaux@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.834Z"},{"year":2026,"hash":"02121252d0733e876cfd3ca2952d0f57d12b85d4e21db601ba26f97583d60b1a","personId":"69ddfbfae910b6872d05ca7e","name":"Denis Matias","email":"denis.matias@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.830Z"},{"year":2026,"hash":"b40b7db7301c9f890151bfaa920b507d6d47b33d580d2c106f279999e43e5296","personId":"69dbc07289ecf04f84100212","name":"Laurent Duding","email":"laurent.duding@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.826Z"},{"year":2026,"hash":"d022f56d0fed78090e6e917a5f18546586e21553a67cf946434f178dc9c8364c","personId":"69ddfbf9e910b6872d05c9ca","name":"Mohamed Zarook Mohamed Zaahid","email":"mohamed.zarookmohamedzaahid@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.823Z"},{"year":2026,"hash":"af16ba1f0cba84fc6b4551026d588e0a2305621fd8c4054d48ecba22e9175eb6","personId":"69dbc07289ecf04f84100220","name":"Cédric Kind","email":"cedric.kind@paleo.ch","expiresAt":"2026-05-05T11:48:17.818Z"},{"year":2026,"hash":"ed9d30107518a43d96a9a31e5ebce257f63f9380e2d9ff4b5257fafcddfd2e1e","personId":"69ddfbfae910b6872d05cb17","name":"Morier Mina","email":"morier.mina@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.814Z"},{"year":2026,"hash":"e7114fa87a5dae32104d0f491547b1c19df6008e387700a2277729d36aebb5da","personId":"69dbc07289ecf04f84100217","name":"Guillaume Blanco","email":"guillaume.blanco@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.810Z"},{"year":2026,"hash":"bd2147c4450af9b3df977a5a9db1999836b340356e75155484fff3cc14f627b5","personId":"69ddfbf9e910b6872d05c95b","name":"Al Hussein Mussa","email":"al.husseinmussa@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.806Z"},{"year":2026,"hash":"007ee8f3cc70e38cadb96de7f1648c9cd14bd770107af6a0381440d2ce0ba2d9","personId":"69dbc07289ecf04f84100206","name":"Mathieu Meylan","email":"mathieu.meylan@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.801Z"},{"year":2026,"hash":"cebf015b483d5a16dd1a52e937900f9edf8fa2c878f6835ef0b240fec25d55f9","personId":"69dbb567d9434724eaa11258","name":"Gabriel Maret","email":"gab.maret@gmail.com","expiresAt":"2026-05-05T11:48:17.796Z"},{"year":2026,"hash":"e296ce076e8969035c181dc6426951289a6ff4073f812f35f10cf601f8237314","personId":"69ddfbf9e910b6872d05c99a","name":"Velickovic Mateja","email":"velickovic.mateja@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.793Z"},{"year":2026,"hash":"e18c02de6794d94cd8e86da842aeafd7d37840ed4e3da144843cce8deaacda39","personId":"69dbc07289ecf04f841001f4","name":"Alexis Gugler","email":"alexis.gugler@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.790Z"},{"year":2026,"hash":"1bc487d16e32bd018d5cae83d5bd576f410c00ecd7abed95b14775d6f8262d04","personId":"69ddfbfae910b6872d05ca93","name":"Tecle Siem Biniam","email":"tecle.siembiniam@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.787Z"},{"year":2026,"hash":"5c7ed40bf7b90f28a2892b6531308bae6f272fa972cf25aaed7fbcbe034a6708","personId":"69dbb567d9434724eaa1126d","name":"Max Roy","email":"max.roy@netzys.ch","expiresAt":"2026-05-05T11:48:17.784Z"},{"year":2026,"hash":"6b45928c464968dbf8be24138156dfbc461c3d81c578c9ed09d0bfe10760f186","personId":"69dbb567d9434724eaa1123d","name":"Arnaud Sartoni","email":"arnaud.sartoni@epfl.ch","expiresAt":"2026-05-05T11:48:17.781Z"},{"year":2026,"hash":"06febeadd822183ea876ebcd90b750abc994580d9f0c3974c01988b842ccc21b","personId":"69ddfbf9e910b6872d05ca0f","name":"Moser Even Gavrie","email":"moser.evengavrie@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.777Z"},{"year":2026,"hash":"3173e8652b947273079f6845fbe0827e6dcd72a86c88997050e636c763d96335","personId":"69dbc07289ecf04f841001fd","name":"Sheyla Oliveira Kobi","email":"sheyla.oliveira@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.774Z"},{"year":2026,"hash":"0a0c2583e0504ba2d89f8a602c79a64bc8be0e8e5f41f48375077f7c7eaa20a1","personId":"69ddfbfae910b6872d05ca39","name":"Wu Guoxu","email":"wu.guoxu@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.770Z"},{"year":2026,"hash":"627cac11bfd152b3b8fc076d69f75189ccb19bb462bd73b41db6835c591ec107","personId":"69dbb567d9434724eaa11282","name":"Raphaël Favre","email":"raphael.favre@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.768Z"},{"year":2026,"hash":"a1aaedd302ef07740f0b606869b35c7a58b26015e7b2b3e085e1a5cf2eaed5d2","personId":"69dbb567d9434724eaa1123a","name":"Alexandre Graf","email":"alg@web-services.com","expiresAt":"2026-05-05T11:48:17.765Z"},{"year":2026,"hash":"a81075b3bd9137ab1aab627ba72e28a0eb2cb55964e49b1273fd3b7ac4ba5ec7","personId":"69ddfbfae910b6872d05cb45","name":"Ristic Christopher","email":"ristic.christopher@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.762Z"},{"year":2026,"hash":"1a7abb2ae72548f3ef059269d515e6d33471ebacb7f32af9160cfb62598802fc","personId":"69dbb567d9434724eaa1125e","name":"Jean-Luc Roduit","email":"dedecop2@gmail.com","expiresAt":"2026-05-05T11:48:17.759Z"},{"year":2026,"hash":"ab25bda400974064f17959b95333531f74b6d5d11b029f8c34f647715a155ee0","personId":"69ddfbf9e910b6872d05ca24","name":"Pages Marius","email":"pages.marius@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.756Z"},{"year":2026,"hash":"5f89cbd7cfef4a04cea29f1d0bb4db9413bf5c348070e173a607521843a6917d","personId":"69ddfbfae910b6872d05cadb","name":"Alain Girardet","email":"alain.girardet@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.752Z"},{"year":2026,"hash":"c64689d37174e44dba03f3f310ac67b16d9bfe4d3b617b5c6c93c3c319f9b3b1","personId":"69dbb567d9434724eaa1128e","name":"Suleyman Ceran","email":"sueleyman.ceran@gmail.com","expiresAt":"2026-05-05T11:48:17.749Z"},{"year":2026,"hash":"a84c21fb97d65b73b8b31c588fc4985a61cbd130d62003c1b15fdee2a4a83bb3","personId":"69ddfbf9e910b6872d05c946","name":"Mares Julien Pierre","email":"mares.julienpierre@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.746Z"},{"year":2026,"hash":"122cb3345423b4a4da451f6eb8ac1af5debbb374844d91aed49e84e9e84238db","personId":"69ddfbf9e910b6872d05c931","name":"Moia Luke","email":"moia.luke@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.743Z"},{"year":2026,"hash":"3b03047c6b21a2829fe5051e91b178643b2a1fa7401a880f52156a9574d5c6c7","personId":"69dbc07289ecf04f841001fa","name":"Helder Manuel Costa Lopes","email":"helder.costa@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.740Z"},{"year":2026,"hash":"2fec05405cea1cbc27caee6b833e06dca806f9973ff571f4bfef11f85c716768","personId":"69dbc07289ecf04f8410023a","name":"Antoine Mveng Evina","email":"antoine.mveng@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.736Z"},{"year":2026,"hash":"d80856ffa4b2424659703569b282c45e48580c509fb0e53fd2e0f3df1e86aacf","personId":"69dbb567d9434724eaa1128b","name":"Sofia Roy","email":"sofia.roy@netzys.ch","expiresAt":"2026-05-05T11:48:17.733Z"},{"year":2026,"hash":"20073ee267f97bf88da22b00bdae5dc18b53aa879c592850afa69ce538eddf73","personId":"69ddfbf9e910b6872d05c9df","name":"Khalil Mateen Salem","email":"khalil.mateensalem@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.731Z"},{"year":2026,"hash":"499ab22497bd5a4edd0d479ed0073402bdace53f464ca3b4d20ae7b099fa654a","personId":"69dbc07289ecf04f84100229","name":"Grégory Charmier","email":"gregory.charmier@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.727Z"},{"year":2026,"hash":"5ce3644f9a75ce73165bc8e8f881c258e0ab07ba5018d689f578ceb833cb10f7","personId":"69ddfbfae910b6872d05ca4e","name":"Lopardo Alessio","email":"lopardo.alessio@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.723Z"},{"year":2026,"hash":"f7d8827b52f9042b3825d80fb482d729a1a988849d0359d7a9a1db1bcf4226c5","personId":"69dbc07289ecf04f84100203","name":"Dimitrios Lymberis","email":"dimitrios.lymberis@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.718Z"},{"year":2026,"hash":"f24629ed40113d986ec1b71c780f431ca3ee998d27f05f448e7764539365e0b6","personId":"69dbb567d9434724eaa1124f","name":"Diego Criscenti","email":"diego.criscenti@hepl.ch","expiresAt":"2026-05-05T11:48:17.715Z"},{"year":2026,"hash":"f8c896a13e3ca6f6bcdb530ac8fd2a6cf6659fb45b630bec9ce3fc06018d048d","personId":"69dbb567d9434724eaa11264","name":"Luc Venries","email":"luc.venries@epfl.ch","expiresAt":"2026-05-05T11:48:17.712Z"},{"year":2026,"hash":"827ee1ee36975b9c9d322c53f2c54299c4b84ccf57d1246c9cb02ab0e7d2181d","personId":"69ddfbf9e910b6872d05c985","name":"Metroz Quenti","email":"metroz.quenti@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.709Z"},{"year":2026,"hash":"86c14fea4d3c4992c6a152fad4b3051553d65abf2b8f6ab1ab4a5a2b28bc7c0f","personId":"69dbb567d9434724eaa11291","name":"Volkan Sutcu","email":"volkan.sutcu@hotmail.com","expiresAt":"2026-05-05T11:48:17.705Z"},{"year":2026,"hash":"2cb95de6c83dd9b0daad3a6f339128ae55d60baf511a0a56edfd30064d2cbaa2","personId":"69ddfbfae910b6872d05cabd","name":"Rodrigues Lopes Diogo Filipe","email":"rodrigues.lopesdiogofilipe@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.702Z"},{"year":2026,"hash":"5d04f8d98bf7fe50081c1f069b1d1c050e8292dc338c4e78ccd3c82800817b31","personId":"69dbc07289ecf04f84100200","name":"Alain Garraux","email":"alain.garraux@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.699Z"},{"year":2026,"hash":"969e26662a9e43d02b9da9380dd79b4030030e9b55c7b19428f4a80b72733416","personId":"69dbc07289ecf04f8410022c","name":"Xavier Carrel","email":"xavier.carrel@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.696Z"},{"year":2026,"hash":"4a2c44ba7ac5a2eaf9f891998b48190ae1bcbce2804581371880b09c92f7851f","personId":"69dbc07289ecf04f84100237","name":"Pascal Piot","email":"pascal.piot@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.692Z"},{"year":2026,"hash":"8daa17535568ec6b8aecb71db665dfd8e8dd194c5796eb807914715bd01ac3f7","personId":"69dbb567d9434724eaa11252","name":"Ernesto Montemayor","email":"ernesto@bati-technologie.ch","expiresAt":"2026-05-05T11:48:17.689Z"},{"year":2026,"hash":"9100f76b67d02de40d68a22f0227f8cb975f2ab04e4f58f370997c506ad9a293","personId":"69dbc07289ecf04f8410021a","name":"Romain Rosay","email":"romain.rosay@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.686Z"},{"year":2026,"hash":"c9773c9050c52623fb70a03f0d6e370ae83d695af6c10f2cbe0476ef13923767","personId":"69dbb567d9434724eaa11249","name":"Claude-Albert Muller Theurillat","email":"expertclaude65@gmail.com","expiresAt":"2026-05-05T11:48:17.683Z"},{"year":2026,"hash":"e3ded533533e2196619392c0132d69267b920c765218387677dbcc8ccf93b338","personId":"69dbc07289ecf04f84100240","name":"Gael Sonney","email":"gael.sonney@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.679Z"},{"year":2026,"hash":"c24fde1576ebf5e0d84f1c55fd14d6df19bf073d272a581079d2f265358bcddd","personId":"69e609d712f10335dc69cb3c","name":"Nemanja Pantic","email":"nemo.pantic@gmail.com","expiresAt":"2026-05-05T11:48:17.676Z"},{"year":2026,"hash":"2bef3aef7cceccea1119dac1ad7c3fc53a6b0e5ec77ba37bd3d1787c27b4880d","personId":"69dbb567d9434724eaa11267","name":"Mathias Giroud","email":"giroud@cinformatique.ch","expiresAt":"2026-05-05T11:48:17.672Z"},{"year":2026,"hash":"a225bf0be032d23f83774f4cafd973b63ad474a563adcb4b640d91ab3ee12f0b","personId":"69dbb567d9434724eaa11279","name":"Nicolas Borboën","email":"nicolas.borboen@epfl.ch","expiresAt":"2026-05-05T11:48:17.668Z"},{"year":2026,"hash":"14f2276398c0404f70a51142ffe4603b9fcd616d1455868a907179e113483355","personId":"69ddfbf8e910b6872d05c907","name":"Nardou Thomas Louis","email":"nardou.thomaslouis@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.664Z"},{"year":2026,"hash":"d7353371f6fcbdf009a43ffcb4ceec916c8ee1bbcf857083c3a28dc66f27fcc6","personId":"69dbc07289ecf04f84100231","name":"Jonathan Melly","email":"jonathan.melly@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.662Z"},{"year":2026,"hash":"29a039f4af496e7dbed93e08d3dba0ec62b2b924ce89f23953b343ac3b216901","personId":"69dbb567d9434724eaa11270","name":"Michael Wyssa","email":"michael.wyssa@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.659Z"},{"year":2026,"hash":"893f01395b91ce76537167eaaf7d8f84d71de8720b02dd5e8eac97a30d438a36","personId":"69dbb567d9434724eaa11288","name":"Serge Wenger","email":"serge.wenger@matisa.ch","expiresAt":"2026-05-05T11:48:17.655Z"},{"year":2026,"hash":"634427cec566412fdc92ea1513cd508b36b32751934fbeb53878d6c172e02e58","personId":"69dbc07289ecf04f84100234","name":"Aurélie Curchod","email":"aurelie.curchod@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.650Z"},{"year":2026,"hash":"0d25edbd7f25d76973bc395b9f611bfab9cfe255378d0f89a1c34ff2ed2efd4b","personId":"69dbb567d9434724eaa1127f","name":"Pascal Benzonana","email":"pascal.benzonana@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.647Z"},{"year":2026,"hash":"2c254a23976a451dd165d96c9b55e15691b12a445fe38739de8124febc33d74c","personId":"69dbc07289ecf04f841001f7","name":"Isabelle Stucki","email":"isabelle.stucki@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.644Z"},{"year":2026,"hash":"c064d1c853220dd9e07d2c5f9377a831095763381335a85880f348b4533ff1cb","personId":"69dbb567d9434724eaa1125b","name":"Jason Crisante","email":"jasoncrisantepro@outlook.com","expiresAt":"2026-05-05T11:48:17.640Z"},{"year":2026,"hash":"d31e561d2480b76e216e265425bbe1be691c1ef24e3ec9fc0950cff4b950f7ba","personId":"69dbb567d9434724eaa1124c","name":"Daniel Berney","email":"daniel.berney@heig-vd.ch","expiresAt":"2026-05-05T11:48:17.635Z"},{"year":2026,"hash":"c5cb31da3cb4dbb9a05f40375f415a72cd8312723a433e43e7f85ace9739e5ca","personId":"69ddfbf8e910b6872d05c895","name":"Diezi Valentin","email":"diezi.valentin@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.632Z"},{"year":2026,"hash":"027eb5f4eb2b5b75dce4fa95f93a9d78003ef2d0b27125c547902081e09885ac","personId":"69dbb567d9434724eaa11261","name":"Karim Bourahla","email":"karim.bourahla@eduvaud.ch","expiresAt":"2026-05-05T11:48:17.629Z"},{"year":2026,"hash":"a25b6fbb2e4dbd52e021b8cd13a2ce82b746e758dd796413223b09d810088679","personId":"69dbb567d9434724eaa11273","name":"Michel Ange Delgado","email":"michel.delgado@bluewin.ch","expiresAt":"2026-05-05T11:48:17.626Z"},{"year":2026,"hash":"c7174c76276208ecddaa60faa1be1249c121b79c9b711e8edd07d8cd84130011","personId":"69dbb567d9434724eaa11246","name":"Carlos Perez","email":"carlos.perez@epfl.ch","expiresAt":"2026-05-05T11:48:17.622Z"},{"year":2026,"hash":"08acb99155a1c559df02e84e6d3f8997a621ec758ab25c0144f9be9583743e27","personId":"69ddfbf8e910b6872d05c8aa","name":"Amstutz Gabriele","email":"amstutz.gabriele@tpiorganizer.ch","expiresAt":"2026-05-05T11:48:17.528Z"},{"year":2026,"hash":"757df51663f32e62e97ae92e112bdf44255e05063e4c3066b261a22104754f82","personId":"69ddfbf8e910b6872d05c8c2","name":"Roudet Alexy Julien","email":"roudet.alexyjulien@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.850Z"},{"year":2026,"hash":"6e3c2d729d25b78385123b549f821dec3b753d885199accb7570982a9b1f3fc0","personId":"69dbb567d9434724eaa11276","name":"Mikael Gonzalez","email":"mikael.gonzalez7@gmail.com","expiresAt":"2026-05-04T13:54:47.846Z"},{"year":2026,"hash":"9ad40520660d0963c52efb6266cf805a5442bb6a8ed97cddc788612c846f332e","personId":"69ddfbf8e910b6872d05c8d7","name":"Lordon Lucas","email":"lordon.lucas@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.841Z"},{"year":2026,"hash":"ad4f22c39eed13d6f5d7751494356db38b81eaabe996a7465b134b45b4e8f1c0","personId":"69ddfbf8e910b6872d05c8ef","name":"Rodrigues Sousa Tiago","email":"rodrigues.sousatiago@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.836Z"},{"year":2026,"hash":"73946ffe7bdcfe1fb582ae98d8d09a43ec71dd971464869dcab348e330c45a6a","personId":"69e60b5412f10335dc69cbf5","name":"Laurent Deschamps","email":"laurent.deschamps@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.832Z"},{"year":2026,"hash":"14409c1abddbfdb6eae1032a3055b1596abc1b80f792ee8d4ce913bc655f0a8e","personId":"69dbb567d9434724eaa11237","name":"Alain Pittet","email":"alain.pittet@info-domo.ch","expiresAt":"2026-05-04T13:54:47.827Z"},{"year":2026,"hash":"515ee32a8ecc647dd67cf7133d799c4655bcd40f351d6e7ef14eef90c5d5c26c","personId":"69ddfbfae910b6872d05cb02","name":"Skupovska Veronika","email":"skupovska.veronika@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.821Z"},{"year":2026,"hash":"696a1db16aad83b2340f136e6b35eec07152fa5afc858a778a4ce5f62c1dcad1","personId":"69ddfbf9e910b6872d05c970","name":"Belkhiria Sofiene Habib","email":"belkhiria.sofienehabib@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.816Z"},{"year":2026,"hash":"8e9703d83bfe05b67d33433e28d9d9584bf78b7cca1d475ebdcc03601efd2f23","personId":"69dbc07289ecf04f8410021d","name":"Londero Maeva","email":"maeva.londero@epfl.ch","expiresAt":"2026-05-04T13:54:47.811Z"},{"year":2026,"hash":"aebf86d385ab192edbacd72434578fcd09f7e537bca998b58a6b01487c8ae25a","personId":"69dbc0c389ecf04f8410025f","name":"Bertrand Sahli","email":"bertrand.sahli@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.806Z"},{"year":2026,"hash":"d915d7aa5749ceca5862e403c979cb516afa2c1d7059ca5e7013f5c6a1c1e126","personId":"69dbb567d9434724eaa1127c","name":"Olivier Mellina","email":"mellina.olivier@gmail.com","expiresAt":"2026-05-04T13:54:47.802Z"},{"year":2026,"hash":"526d073496e16b164cc606a01d579db32606e572f8c2055ae9be6436e3377cf6","personId":"69e4e15e10790eb80e9b4f65","name":"Carneiro Yohan","email":"carneiro.yohan@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.795Z"},{"year":2026,"hash":"3c1c83e1fe33ef79cf29489b9af1ee944eb6e013d4618892a818e4e1f17ce97f","personId":"69dbc07289ecf04f8410023d","name":"Roberto Ferrari","email":"roberto.ferrari@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.787Z"},{"year":2026,"hash":"5671e3dcac32b7860c3d318884ecdb0ca85a661c3e778383da6e8c7353274d6a","personId":"69ddfbf9e910b6872d05c91c","name":"Racine Thibaud","email":"racine.thibaud@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.780Z"},{"year":2026,"hash":"9732a953962a89c78e2471e3370e38dfe4654e9494ecc5042b09da9d7acff35b","personId":"69dbc07289ecf04f8410020c","name":"Cédric Schaffter","email":"cedric.schaffter@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.774Z"},{"year":2026,"hash":"3307ab088ccef0282e26147aa703d729f62ab419d95ff5509ec28a7b1fa0380b","personId":"69dbb567d9434724eaa11240","name":"Bernard Oberson","email":"oberson.bernard@gmail.com","expiresAt":"2026-05-04T13:54:47.769Z"},{"year":2026,"hash":"d18b40f62754a5e674bef3243d422985c039d783178bfeeba9492522089a94fb","personId":"69ddfbf9e910b6872d05c9b5","name":"Almeida Sampaio Nelson Filipe","email":"almeida.sampaionelsonfilipe@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.764Z"},{"year":2026,"hash":"6ccf0e6144511cf9aea7f9f52222ddbeb5b5ec2ba66a9e2f96b020456211f528","personId":"69e754332ccbf98274ca0810","name":"Albert Richard","email":"albert.richard@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.760Z"},{"year":2026,"hash":"b6cb2db17509c80d7033999b5b158b618b0b9e6711f087d056073dec84ec5444","personId":"69dbc07289ecf04f8410020f","name":"Patrick Chenaux","email":"patrick.chenaux@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.755Z"},{"year":2026,"hash":"7941c0615fd1bad22597b0b4d15d551c258d396c3e958e5cc2f0d110aa671073","personId":"69ddfbfae910b6872d05ca7e","name":"Denis Matias","email":"denis.matias@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.751Z"},{"year":2026,"hash":"a8f6c90aab6946514882a4281fbfe71ba65f0260a0f66ca77e2a0784948fa5bf","personId":"69dbc07289ecf04f84100212","name":"Laurent Duding","email":"laurent.duding@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.747Z"},{"year":2026,"hash":"98d588638b068e900bc76f94f9942545dc94322453a3eedc5c792fd30ce41301","personId":"69ddfbf9e910b6872d05c9ca","name":"Mohamed Zarook Mohamed Zaahid","email":"mohamed.zarookmohamedzaahid@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.743Z"},{"year":2026,"hash":"870f1eda23da037a7f45a32b4504a96e646a0c0661c559989461ac646286544f","personId":"69dbc07289ecf04f84100220","name":"Cédric Kind","email":"cedric.kind@paleo.ch","expiresAt":"2026-05-04T13:54:47.738Z"},{"year":2026,"hash":"55617135b27533fb13e16f1512563ef3100d5cde35c2ba99b743df22c1f7527b","personId":"69ddfbfae910b6872d05cb17","name":"Morier Mina","email":"morier.mina@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.734Z"},{"year":2026,"hash":"236c88f9f0e27ef6e510d0a4a574f5c629b45f630cf010c9d3cd329bc57583ca","personId":"69dbc07289ecf04f84100217","name":"Guillaume Blanco","email":"guillaume.blanco@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.730Z"},{"year":2026,"hash":"5f9f2fd043dc69539f5ac66a44c5f45444c9b8ea392532993c97d5f64c9075fd","personId":"69ddfbf9e910b6872d05c95b","name":"Al Hussein Mussa","email":"al.husseinmussa@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.722Z"},{"year":2026,"hash":"212ccba127df74031c6742b70d0393acd41b8dc8a05bacf7b60d26e5131a4b3f","personId":"69dbc07289ecf04f84100206","name":"Mathieu Meylan","email":"mathieu.meylan@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.718Z"},{"year":2026,"hash":"53c9df064b0a2a8ae5b3b3d9b4f5608e0a9235aa9100245d4ad2dce09f188130","personId":"69dbb567d9434724eaa11258","name":"Gabriel Maret","email":"gab.maret@gmail.com","expiresAt":"2026-05-04T13:54:47.714Z"},{"year":2026,"hash":"496c2474426ff4f39a455f6629e6f4f6323cfd8e3c258c2279946088b66df3bf","personId":"69ddfbf9e910b6872d05c99a","name":"Velickovic Mateja","email":"velickovic.mateja@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.709Z"},{"year":2026,"hash":"67c44c8c182e68a19f6505e6678669fd5c2cabe1ec723c3e91b8d1e369024db6","personId":"69dbc07289ecf04f841001f4","name":"Alexis Gugler","email":"alexis.gugler@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.704Z"},{"year":2026,"hash":"e146e41f507ec77b40aacf4aef55f21e7ff5dba133943fff088aa0896975805b","personId":"69ddfbfae910b6872d05ca93","name":"Tecle Siem Biniam","email":"tecle.siembiniam@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.697Z"},{"year":2026,"hash":"4050c87460e0e3e433c497fcc2a2094b49ff399b6d92dea4a05ce96b26852ee5","personId":"69dbb567d9434724eaa1126d","name":"Max Roy","email":"max.roy@netzys.ch","expiresAt":"2026-05-04T13:54:47.691Z"},{"year":2026,"hash":"57ac538fbb2622607baee8b13e748b20e704b38eb97fbd14735e11d54aa8bd24","personId":"69dbb567d9434724eaa1123d","name":"Arnaud Sartoni","email":"arnaud.sartoni@epfl.ch","expiresAt":"2026-05-04T13:54:47.685Z"},{"year":2026,"hash":"f5d43e34ad45fc1d6e55feb2212bdb6d1c777ebaa26d376e3aa50eb56bed95cb","personId":"69ddfbf9e910b6872d05ca0f","name":"Moser Even Gavrie","email":"moser.evengavrie@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.678Z"},{"year":2026,"hash":"2ce45a3e189f878be5efb4e1b7fdaa80c55396320a5bcdaf0ed28e53bba22242","personId":"69dbc07289ecf04f841001fd","name":"Sheyla Oliveira Kobi","email":"sheyla.oliveira@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.673Z"},{"year":2026,"hash":"1825378eda3f1ca575364e84dfac71f389f244b49563769d9c081cfc18f4fb12","personId":"69ddfbfae910b6872d05ca39","name":"Wu Guoxu","email":"wu.guoxu@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.669Z"},{"year":2026,"hash":"ab13bedbfc013261cea119e36e00555a5481c858bb4cfac091865da45b4251f3","personId":"69dbb567d9434724eaa11282","name":"Raphaël Favre","email":"raphael.favre@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.665Z"},{"year":2026,"hash":"3420ca6b1c86be2bf1a3c607fdad89f1ea3a284268b15fd42a089e2d173dc8d7","personId":"69dbb567d9434724eaa1123a","name":"Alexandre Graf","email":"alg@web-services.com","expiresAt":"2026-05-04T13:54:47.661Z"},{"year":2026,"hash":"59021448b1adc491428909354e0b6b8d5a4875de9ffd2ae69ba87089751a16ac","personId":"69ddfbfae910b6872d05cb45","name":"Ristic Christopher","email":"ristic.christopher@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.655Z"},{"year":2026,"hash":"d481f908071361e83a0083c94df83f7d690fb850b29f2350a5aa7c23b7814623","personId":"69dbb567d9434724eaa1125e","name":"Jean-Luc Roduit","email":"dedecop2@gmail.com","expiresAt":"2026-05-04T13:54:47.651Z"},{"year":2026,"hash":"8a5900aa21329c3dab4552d580b513b84298852c889269dda6a84aaf37ba3d1c","personId":"69ddfbf9e910b6872d05ca24","name":"Pages Marius","email":"pages.marius@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.647Z"},{"year":2026,"hash":"fb122cd1c4344ee4c6b3b2d4f2969ac6045a2cd1362ddf59dc7e5b5adf30bb3f","personId":"69ddfbfae910b6872d05cadb","name":"Alain Girardet","email":"alain.girardet@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.643Z"},{"year":2026,"hash":"963ebf4ff2fcd34e7a976da86274fc07793dac1fef41c732cc27e8544c801a5f","personId":"69dbb567d9434724eaa1128e","name":"Suleyman Ceran","email":"sueleyman.ceran@gmail.com","expiresAt":"2026-05-04T13:54:47.638Z"},{"year":2026,"hash":"b6c3f1462257bf6fb5f09f29a9f86cda0a40c7ec205e4fbeadf94df3ade2f1ed","personId":"69ddfbf9e910b6872d05c946","name":"Mares Julien Pierre","email":"mares.julienpierre@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.633Z"},{"year":2026,"hash":"50f130ffec22036680dcbd0def0c9e2a70ea56737c2675fc93fa18bc188029d9","personId":"69ddfbf9e910b6872d05c931","name":"Moia Luke","email":"moia.luke@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.630Z"},{"year":2026,"hash":"8f27ea218d17dc49f4bb978ef5b6cfbb1ce48e6b18c848175b3e51f9902d5158","personId":"69dbc07289ecf04f841001fa","name":"Helder Manuel Costa Lopes","email":"helder.costa@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.626Z"},{"year":2026,"hash":"195f316302f93bd8e9c64e712e5ddcf9071a3b11398ca5ee8337e069562ad353","personId":"69dbc07289ecf04f8410023a","name":"Antoine Mveng Evina","email":"antoine.mveng@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.622Z"},{"year":2026,"hash":"7fd9740e28efbf5a8cdad8ba39e20806014c78fcd8668997f25a898a99f386d0","personId":"69dbb567d9434724eaa1128b","name":"Sofia Roy","email":"sofia.roy@netzys.ch","expiresAt":"2026-05-04T13:54:47.618Z"},{"year":2026,"hash":"aaf10311a5b33f373a4e6aab48022fc5cb1180b3560ad01e4c6cc30feaa9af18","personId":"69ddfbf9e910b6872d05c9df","name":"Khalil Mateen Salem","email":"khalil.mateensalem@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.615Z"},{"year":2026,"hash":"10ebc3b6cfc121f5aee90deea1b3897a180081c0d267f66af0fcf4d50af4c38e","personId":"69dbc07289ecf04f84100229","name":"Grégory Charmier","email":"gregory.charmier@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.611Z"},{"year":2026,"hash":"5aa69d50d5a6f3194f6d770836062f22a94f04b69a0cb9ce78806efa80738aad","personId":"69ddfbfae910b6872d05ca4e","name":"Lopardo Alessio","email":"lopardo.alessio@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.606Z"},{"year":2026,"hash":"3e18506d8d16781e6395aa70d8382df232115be72d8199822cdc4c719445a041","personId":"69dbc07289ecf04f84100203","name":"Dimitrios Lymberis","email":"dimitrios.lymberis@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.602Z"},{"year":2026,"hash":"34f9f10c076d5d006acc908c25f3622bc90944b9ffb411a0e1855b6595d491ee","personId":"69dbb567d9434724eaa1124f","name":"Diego Criscenti","email":"diego.criscenti@hepl.ch","expiresAt":"2026-05-04T13:54:47.598Z"},{"year":2026,"hash":"ae0dd5b7a6a962e7f6b0d7a007ddc5bc9b298cc2a3ed5dbd76b3d742ce058524","personId":"69dbb567d9434724eaa11264","name":"Luc Venries","email":"luc.venries@epfl.ch","expiresAt":"2026-05-04T13:54:47.594Z"},{"year":2026,"hash":"7b6624db13f81206c903e3be7c1c67d1cfb8577b197b40c6f348f3e79dbf254a","personId":"69ddfbf9e910b6872d05c985","name":"Metroz Quenti","email":"metroz.quenti@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.589Z"},{"year":2026,"hash":"41362213fa1cb06370a8a9092f042cea4806ff490c12ef30c83193c79a8d0400","personId":"69dbb567d9434724eaa11291","name":"Volkan Sutcu","email":"volkan.sutcu@hotmail.com","expiresAt":"2026-05-04T13:54:47.585Z"},{"year":2026,"hash":"f8a93828c8faf8698357d077970d44bdeadd58fd8db02ec7aa73508a36576189","personId":"69ddfbfae910b6872d05cabd","name":"Rodrigues Lopes Diogo Filipe","email":"rodrigues.lopesdiogofilipe@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.581Z"},{"year":2026,"hash":"809ffcbee50a0d584f2c54f2f32927f015a397918b4efe7de09c505e7a02d765","personId":"69dbc07289ecf04f84100200","name":"Alain Garraux","email":"alain.garraux@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.578Z"},{"year":2026,"hash":"ad2371074f61b75bf7b76e35781bdf089c33bf25103c496de2e34d4400e917b7","personId":"69dbc07289ecf04f8410022c","name":"Xavier Carrel","email":"xavier.carrel@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.573Z"},{"year":2026,"hash":"3c252f3a3cd2effa638a615e172b905f960a72aa8f308a876ee0f9a237d40267","personId":"69dbc07289ecf04f84100237","name":"Pascal Piot","email":"pascal.piot@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.569Z"},{"year":2026,"hash":"c30a6c5d0b4af53669e7dcbfbf14ae411de95d92b0c8795b0909b66a5e59a05a","personId":"69dbb567d9434724eaa11252","name":"Ernesto Montemayor","email":"ernesto@bati-technologie.ch","expiresAt":"2026-05-04T13:54:47.566Z"},{"year":2026,"hash":"139fb04d76d3910cd720c35b879c93d3d103f43ba03888810ceab7a982dc7cd5","personId":"69dbc07289ecf04f8410021a","name":"Romain Rosay","email":"romain.rosay@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.562Z"},{"year":2026,"hash":"ef11566cb17833a85199efe69818290c836dbab4bb01c66556c7ff8362c44cee","personId":"69dbb567d9434724eaa11249","name":"Claude-Albert Muller Theurillat","email":"expertclaude65@gmail.com","expiresAt":"2026-05-04T13:54:47.558Z"},{"year":2026,"hash":"dd49f485d27dd440ed681c3e6070a972c742b360becc42684fc9d998dad2ebf5","personId":"69dbc07289ecf04f84100240","name":"Gael Sonney","email":"gael.sonney@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.554Z"},{"year":2026,"hash":"22d94ad1d6e7b40232f4913d7f4cb4b29815e595439bab4167f7cb0e459e47ef","personId":"69e609d712f10335dc69cb3c","name":"Nemanja Pantic","email":"nemo.pantic@gmail.com","expiresAt":"2026-05-04T13:54:47.551Z"},{"year":2026,"hash":"d7d1f6e266ce323a5656dd30e654b0782b38c4e3c9fe8244d54df2ff380a9400","personId":"69dbb567d9434724eaa11267","name":"Mathias Giroud","email":"giroud@cinformatique.ch","expiresAt":"2026-05-04T13:54:47.548Z"},{"year":2026,"hash":"748701a4a1d3fc1e33cfd2b45fb42648fb050396b87fdda53c54ab2eff96235f","personId":"69dbb567d9434724eaa11279","name":"Nicolas Borboën","email":"nicolas.borboen@epfl.ch","expiresAt":"2026-05-04T13:54:47.544Z"},{"year":2026,"hash":"a312dacd044c3dc333e2dd581608499d100f108f33d2e3c05e0f82bf852f1922","personId":"69ddfbf8e910b6872d05c907","name":"Nardou Thomas Louis","email":"nardou.thomaslouis@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.540Z"},{"year":2026,"hash":"a88d4a79855ba523b57f2cbbfb4d09115064a52e55106cb6f09f49f002cf9dcc","personId":"69dbc07289ecf04f84100231","name":"Jonathan Melly","email":"jonathan.melly@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.536Z"},{"year":2026,"hash":"b991382f7a2a33a507262821fcd955fe9d4a54b7577b31c5e7e995c3a9a3652a","personId":"69dbb567d9434724eaa11270","name":"Michael Wyssa","email":"michael.wyssa@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.532Z"},{"year":2026,"hash":"84185e08c62e2dd11bd3e4b65d0d143c80e95b8fbe07945d8162c20eb2402a0f","personId":"69dbb567d9434724eaa11288","name":"Serge Wenger","email":"serge.wenger@matisa.ch","expiresAt":"2026-05-04T13:54:47.528Z"},{"year":2026,"hash":"19347baea4f968f022d16cae9752b30f0d747a68d632aaacd3d7e757a577f597","personId":"69dbc07289ecf04f84100234","name":"Aurélie Curchod","email":"aurelie.curchod@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.525Z"},{"year":2026,"hash":"923813648dd1c62e92ccbd896cf13549d8d0dd75b72c4fc843e4e8539cd56d11","personId":"69dbb567d9434724eaa1127f","name":"Pascal Benzonana","email":"pascal.benzonana@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.521Z"},{"year":2026,"hash":"93442499730dd50f32617545b6c31431d8456804472637144fa6c11ba9cb3253","personId":"69dbc07289ecf04f841001f7","name":"Isabelle Stucki","email":"isabelle.stucki@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.517Z"},{"year":2026,"hash":"d202346dbf83d41c71719a6dca7cc46ef44ddb81c4506ede07ca3aa1efe6dc90","personId":"69dbb567d9434724eaa1125b","name":"Jason Crisante","email":"jasoncrisantepro@outlook.com","expiresAt":"2026-05-04T13:54:47.513Z"},{"year":2026,"hash":"b0ee01a5048dc70aba666566cd37d3e99da96dead0769719d45ec3e7e16acedc","personId":"69dbb567d9434724eaa1124c","name":"Daniel Berney","email":"daniel.berney@heig-vd.ch","expiresAt":"2026-05-04T13:54:47.509Z"},{"year":2026,"hash":"bb740f2294a32479958080eaa779faa24665d72281ad98a346c5de786a5c205f","personId":"69ddfbf8e910b6872d05c895","name":"Diezi Valentin","email":"diezi.valentin@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.505Z"},{"year":2026,"hash":"f99c988853c87245f1632af207098bb0b22b1fe65845b5e95575f4bce1221159","personId":"69dbb567d9434724eaa11261","name":"Karim Bourahla","email":"karim.bourahla@eduvaud.ch","expiresAt":"2026-05-04T13:54:47.501Z"},{"year":2026,"hash":"e4fb17ab98df95dc36183fa7ad6de030eb1bea193ebb1db23b0e31c36faf1da8","personId":"69dbb567d9434724eaa11273","name":"Michel Ange Delgado","email":"michel.delgado@bluewin.ch","expiresAt":"2026-05-04T13:54:47.497Z"},{"year":2026,"hash":"a36c6463a595b788068fe268487e5927cc537e776525c31384ca53377285bfc3","personId":"69dbb567d9434724eaa11246","name":"Carlos Perez","email":"carlos.perez@epfl.ch","expiresAt":"2026-05-04T13:54:47.493Z"},{"year":2026,"hash":"e998a424278208d0479326b7fd738df530178278767f43b07110ad9f29db1798","personId":"69ddfbf8e910b6872d05c8aa","name":"Amstutz Gabriele","email":"amstutz.gabriele@tpiorganizer.ch","expiresAt":"2026-05-04T13:54:47.472Z"}]
STATIC_ACCESS_JSON, true) ?: [];

function staticPublicationDeny(int $statusCode = 403): void
{
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=utf-8');
    echo <<<'STATIC_DENIED_HTML'
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Accès protégé</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    main {
      width: min(92vw, 520px);
      padding: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.4rem;
    }
    p {
      margin: 0;
      color: #475569;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main>
    <h1>Accès protégé</h1>
    <p>La consultation des défenses 2026 nécessite un lien magique valide.</p>
  </main>
</body>
</html>
STATIC_DENIED_HTML;
    exit;
}

$staticToken = isset($_GET['ml']) && is_string($_GET['ml']) ? trim($_GET['ml']) : '';

if ($staticToken === '' || strlen($staticToken) < 32 || strlen($staticToken) > 256) {
    staticPublicationDeny(403);
}

$staticTokenHash = hash('sha256', $staticToken);
$staticAccessEntry = null;

foreach ($staticAccessLinks as $candidateAccessEntry) {
    $candidateHash = isset($candidateAccessEntry['hash']) && is_string($candidateAccessEntry['hash'])
        ? $candidateAccessEntry['hash']
        : '';

    if ($candidateHash !== '' && hash_equals($candidateHash, $staticTokenHash)) {
        $staticAccessEntry = $candidateAccessEntry;
        break;
    }
}

if (!is_array($staticAccessEntry)) {
    staticPublicationDeny(403);
}

$staticExpiresAt = isset($staticAccessEntry['expiresAt']) && is_string($staticAccessEntry['expiresAt'])
    ? strtotime($staticAccessEntry['expiresAt'])
    : false;

if ($staticExpiresAt !== false && $staticExpiresAt <= time()) {
    staticPublicationDeny(410);
}

$staticViewer = [
    'personId' => $staticAccessEntry['personId'] ?? null,
    'name' => $staticAccessEntry['name'] ?? null,
    'email' => $staticAccessEntry['email'] ?? null,
];

$staticMagicLinkBootstrap = '<script>window.__STATIC_MAGIC_LINK_VALIDATED__=true;window.__STATIC_MAGIC_LINK_VIEWER__=' .
    json_encode($staticViewer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) .
    ';</script>';
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Défenses 2026</title>
  <style>:root {
  --soutenance-page-gutter-inline: clamp(10px, 2vw, 24px);
  --soutenance-card-radius: 12px;
  --soutenance-space-1: 8px;
  --soutenance-space-2: 12px;
  --soutenance-space-3: 16px;
  --soutenance-space-4: 20px;
  --soutenance-bg-etml: rgba(102, 0, 227, 0.07);
  --soutenance-bg-cfpv: rgba(222, 32, 146, 0.07);
  --soutenance-accent-etml: #6700e3;
  --soutenance-accent-cfpv: #de2092;
  --soutenance-border: var(--app-border, #dbe4ee);
  --soutenance-border-soft: var(--app-border-soft, #dce9ff);
  --soutenance-surface: var(--app-surface, #ffffff);
  --soutenance-surface-soft: #f8fafc;
  --soutenance-text-main: var(--app-text-main, #0f172a);
  --soutenance-text-muted: var(--app-text-muted, #4b5563);
  --soutenance-text-subtle: #475569;
  --soutenance-shadow: var(--app-shadow-card, 0 10px 24px rgba(15, 23, 42, 0.08));
  --soutenance-reveal-distance: 10px;
  --soutenance-reveal-duration: 200ms;
  --soutenance-reveal-stagger: 48ms;
  --soutenance-row-gap: 6px;
  --soutenance-pill-radius: 999px;
  --soutenance-grid-label-min: 88px;
  --soutenance-grid-actions: 44px;
  --soutenance-contrast-strong: #e2e8f0;
  --soutenance-room-header-badge-height: 1.18rem;
  --soutenance-room-header-date-height: 1.1rem;
  --soutenance-room-header-title-height: 1.45rem;
  --soutenance-room-title-reserve: 88px;
  --soutenance-grid-columns: 1;
  --soutenance-focus-scale: 1;
  --soutenance-focus-inverse-scale: 1;
  --soutenance-fullscreen-padding: 10px;
  --soutenance-fullscreen-room-width: 168px;
}

.tpi-soutenance-page {
  box-sizing: border-box;
  position: relative;
  width: min(100%, var(--app-page-width));
  max-width: var(--app-page-width);
  margin-inline: auto;
  padding:
    var(--room-padding-top, 72px)
    var(--soutenance-page-gutter-inline)
    48px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--soutenance-space-3);
  overflow-x: hidden;
  color: var(--soutenance-text-main);
  font-family: var(--app-ui-font-family, "Trebuchet MS", "Segoe UI", "Aptos", sans-serif);
}

.tpi-soutenance-page * {
  box-sizing: border-box;
}

@media (prefers-reduced-motion: no-preference) {
  .tpi-soutenance-page .salle {
    animation: soutenance-reveal-room var(--soutenance-reveal-duration) cubic-bezier(0.2, 0.6, 0.2, 1) both;
    animation-delay: calc(var(--room-reveal-index, 0) * var(--soutenance-reveal-stagger));
  }

  .tpi-soutenance-page .tpi-data {
    animation: soutenance-reveal-row var(--soutenance-reveal-duration) cubic-bezier(0.2, 0.6, 0.2, 1) both;
    animation-delay: calc((var(--room-reveal-index, 0) * var(--soutenance-reveal-stagger)) + (var(--slot-reveal-index, 0) * 22ms));
  }
}

@media (prefers-reduced-motion: reduce) {
  .tpi-soutenance-page .salle,
  .tpi-soutenance-page .tpi-data {
    animation: none;
  }
}

@keyframes soutenance-reveal-room {
  from {
    opacity: 0;
    transform: translateY(var(--soutenance-reveal-distance));
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes soutenance-reveal-row {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Titres / en-têtes */
.tpi-soutenance-page .title,
.tpi-soutenance-page .demo {
  margin: 0;
  font-size: clamp(1.6rem, 2vw + 1rem, 2.05rem);
  text-transform: capitalize;
  font-weight: 700;
  line-height: 1.12;
  background-image: linear-gradient(90deg, var(--soutenance-accent-etml), var(--soutenance-accent-cfpv));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.tpi-soutenance-page .demo::after {
  content: "Version de démonstration";
  display: inline-flex;
  margin-left: 10px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #f8fafc;
  background: #475569;
  vertical-align: middle;
}

.tpi-soutenance-page .tpi-soutenance-page p,
.tpi-soutenance-page p {
  margin: 0;
}

/* Barre d’actions + filtres (desktop/tablette) */
.tpi-soutenance-page .soutenance-toolbar {
  width: 100%;
  background: var(--soutenance-surface);
  border: 1px solid var(--soutenance-border);
  border-radius: var(--soutenance-card-radius);
  box-shadow: var(--soutenance-shadow);
  padding: var(--soutenance-space-2) var(--soutenance-space-2) var(--soutenance-space-3);
  display: grid;
  gap: var(--soutenance-space-2);
}

.tpi-soutenance-page .soutenance-toolbar-head {
  display: flex;
  position: relative;
  overflow: hidden;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--soutenance-space-1);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 14px;
  padding: var(--soutenance-space-2);
  background:
    linear-gradient(130deg, #0f172a 0%, #3b82f6 45%, #c026d3 100%);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

.tpi-soutenance-page .soutenance-toolbar-hero:before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 8% 20%, rgba(255, 255, 255, 0.16), transparent 35%),
    radial-gradient(circle at 88% 25%, rgba(255, 255, 255, 0.1), transparent 28%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.08), transparent 52%);
  pointer-events: none;
  z-index: 0;
}

.tpi-soutenance-page .soutenance-toolbar-hero > * {
  position: relative;
  z-index: 1;
}

.tpi-soutenance-page .soutenance-toolbar-hero .demo::after,
.tpi-soutenance-page .soutenance-toolbar-hero .soutenance-hero-status {
  text-transform: uppercase;
}

.tpi-soutenance-page .soutenance-toolbar-hero .demo::after {
  display: none;
}

.tpi-soutenance-page .soutenance-toolbar-hero-content {
  display: grid;
  gap: 2px;
  max-width: min(100%, 760px);
}

.tpi-soutenance-page .soutenance-hero-kicker {
  margin: 0;
  font-size: 0.66rem;
  font-weight: 800;
  color: rgba(241, 245, 249, 0.92);
  letter-spacing: 0.1em;
  line-height: 1.1;
}

.tpi-soutenance-page .soutenance-toolbar-hero .title,
.tpi-soutenance-page .soutenance-toolbar-hero .demo {
  margin: 0;
  font-size: clamp(1.2rem, 1.5vw + 0.9rem, 1.52rem);
  line-height: 1.12;
  background-image: none;
  -webkit-text-fill-color: #ffffff;
  color: #f8fafc;
  text-transform: capitalize;
}

.tpi-soutenance-page .soutenance-toolbar-greeting {
  margin: 0;
  color: rgba(241, 245, 249, 0.9);
  font-size: 0.8rem;
  line-height: 1.22;
}

.tpi-soutenance-page .soutenance-hero-status {
  justify-self: start;
  border: 1px solid rgba(248, 250, 252, 0.45);
  color: #0f172a;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.tpi-soutenance-page .soutenance-hero-fullscreen-action {
  position: absolute;
  top: 7px;
  right: 10px;
  z-index: 2;
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(248, 250, 252, 0.86);
  border-radius: 999px;
  background: #ffffff;
  color: #1d4ed8;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
  cursor: pointer;
}

.tpi-soutenance-page .soutenance-toolbar-hero.is-fullscreen-active .soutenance-hero-fullscreen-action {
  color: #be123c;
}

.tpi-soutenance-page .soutenance-hero-fullscreen-action:hover {
  background: #ffffff;
  transform: translateY(-1px);
}

.tpi-soutenance-page .soutenance-hero-fullscreen-action:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.tpi-soutenance-page .soutenance-fullscreen-action-icon {
  width: 19px;
  height: 19px;
  display: block;
}

@media (max-width: 767px) {
  .tpi-soutenance-page .soutenance-toolbar-head {
    padding: 10px;
    gap: 8px;
  }

  .tpi-soutenance-page .soutenance-toolbar-hero-content {
    gap: 2px;
  }

  .tpi-soutenance-page .soutenance-toolbar-hero .title,
  .tpi-soutenance-page .soutenance-toolbar-hero .demo {
    font-size: 1.2rem;
    line-height: 1.1;
  }

  .tpi-soutenance-page .soutenance-hero-kicker {
    display: none;
  }

  .tpi-soutenance-page .soutenance-toolbar-greeting {
    font-size: 0.76rem;
  }

  .tpi-soutenance-page .soutenance-hero-status {
    font-size: 0.6rem;
    padding: 5px 9px;
  }

  .tpi-soutenance-page .soutenance-hero-fullscreen-action {
    top: 7px;
    right: 8px;
    width: 32px;
    height: 32px;
  }
}

.tpi-soutenance-page .soutenance-toolbar-filters {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--soutenance-space-1);
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  width: 100%;
  justify-content: center;
}

.tpi-soutenance-page .soutenance-filter-actions {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  flex: 0 0 auto;
  min-width: fit-content;
  margin-right: auto;
  margin-left: auto;
}

.tpi-soutenance-page .soutenance-filter-block--inline {
  max-width: 156px;
  flex: 0 0 auto;
}

.tpi-soutenance-page .soutenance-filter-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 108px;
  max-width: 148px;
  flex: 0 0 auto;
}

.tpi-soutenance-page .soutenance-filter-block select,
.tpi-soutenance-page .btnFilters {
  width: 100%;
  max-width: 148px;
  min-width: 0;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--soutenance-border-soft);
  border-radius: 10px;
  background: #ffffff;
  color: var(--soutenance-text-main);
}

.tpi-soutenance-page .btnFilters {
  width: auto;
  min-width: 104px;
  cursor: pointer;
  font-weight: 700;
  background: #f4f4f5;
}

.tpi-soutenance-page .btnPrint {
  width: auto;
  min-width: 120px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #1e40af;
  border-radius: 10px;
  background: linear-gradient(180deg, #3b82f6, #2563eb);
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.tpi-soutenance-page .btnPrint:hover {
  filter: brightness(0.96);
}

.tpi-soutenance-page .btnPrint--ghost {
  background: #ffffff;
  color: #0f172a;
  border-color: #94a3b8;
}

.tpi-soutenance-page .soutenance-pdf-split {
  display: inline-flex;
  align-items: stretch;
  border-radius: 10px;
  overflow: hidden;
}

.tpi-soutenance-page .btnPdfSplit {
  min-width: 38px;
  width: 38px;
  padding: 0;
  min-height: 36px;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
}

.tpi-soutenance-page .btnPdfSplit--left {
  border-right: 1px solid rgba(148, 163, 184, 0.5);
}

.tpi-soutenance-page .btnPdfSplit--right.btnPrint--ghost {
  border-left: none;
}

.tpi-soutenance-page .btnPdfSplit--left.btnPrint--ghost {
  border-right: none;
}

.tpi-soutenance-page .soutenance-toolbar-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.tpi-soutenance-page .soutenance-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.tpi-soutenance-page .btnPrint:disabled,
.tpi-soutenance-page .btnPrint:disabled:hover {
  cursor: not-allowed;
  opacity: 0.55;
}

.tpi-soutenance-page .btnFilters.active {
  background: #334155;
  color: #ffffff;
  border-color: #334155;
}

.tpi-soutenance-page .btnFilters:hover {
  filter: brightness(0.96);
}

/* États focus / focus perdu */
.tpi-soutenance-page .soutenance-focus-banner {
  margin: 0;
  padding: 13px 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: var(--soutenance-card-radius);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  background: linear-gradient(180deg, #ffffff, #f4f7fc);
  box-shadow: var(--soutenance-shadow);
}

.tpi-soutenance-page .soutenance-focus-banner p {
  margin: 4px 0 0;
  color: var(--soutenance-text-muted);
}

.tpi-soutenance-page .soutenance-focus-banner strong {
  display: block;
}

.tpi-soutenance-page .soutenance-focus-banner.is-missing {
  border-color: rgba(194, 65, 12, 0.18);
}

.tpi-soutenance-page .soutenance-focus-banner button {
  min-height: 36px;
  border-radius: 999px;
  border: 1px solid var(--soutenance-border-soft);
  background: #fff;
  color: var(--soutenance-text-main);
  font-weight: 700;
  padding: 0 14px;
  cursor: pointer;
}

/* Bloc principal (grid stable, sans colonnes multiples) */
.tpi-soutenance-page .soutenances {
  width: 100%;
}

.tpi-soutenance-page .soutenance-main-area {
  width: 100%;
  display: grid;
  gap: var(--soutenance-space-3);
}

.tpi-soutenance-page .soutenances:fullscreen,
.tpi-soutenance-page .soutenances:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
  overflow-x: auto;
  overflow-y: hidden;
  background: #eef4ff;
  padding: var(--soutenance-fullscreen-padding);
}

.tpi-soutenance-page .soutenances:fullscreen .soutenance-main-area,
.tpi-soutenance-page .soutenances:-webkit-full-screen .soutenance-main-area {
  width: max-content;
  min-width: 100%;
  height: 100%;
  overflow: visible;
  align-content: start;
}

.tpi-soutenance-page .soutenances:fullscreen .salles-container,
.tpi-soutenance-page .soutenances:-webkit-full-screen .salles-container {
  width: max-content;
  min-width: calc(100% * var(--soutenance-focus-inverse-scale, 1));
  grid-template-columns: repeat(var(--soutenance-fullscreen-columns), minmax(var(--soutenance-fullscreen-room-width), 1fr)) !important;
  align-items: start;
  gap: 8px;
  transform: scale(var(--soutenance-focus-scale, 1));
  transform-origin: top left;
  will-change: transform;
}

.tpi-soutenance-page .soutenances:fullscreen .salle,
.tpi-soutenance-page .soutenances:-webkit-full-screen .salle {
  min-width: var(--soutenance-fullscreen-room-width);
  padding: 8px;
  gap: 8px;
  --soutenance-row-gap: 4px;
  --soutenance-room-header-badge-height: 0.9rem;
  --soutenance-room-header-date-height: 0.84rem;
  --soutenance-room-header-title-height: 1.06rem;
}

.tpi-soutenance-page .soutenances:fullscreen .room-header,
.tpi-soutenance-page .soutenances:-webkit-full-screen .room-header {
  padding: 0 3px 5px 6px;
  min-height: calc(
    var(--soutenance-room-header-badge-height) + var(--soutenance-room-header-date-height) + var(--soutenance-room-header-title-height) + 7px
  );
  height: calc(
    var(--soutenance-room-header-badge-height) + var(--soutenance-room-header-date-height) + var(--soutenance-room-header-title-height) + 7px
  );
}

.tpi-soutenance-page .soutenances:fullscreen .room-header .site,
.tpi-soutenance-page .soutenances:-webkit-full-screen .room-header .site {
  font-size: 0.62rem;
  padding: 1px 7px;
}

.tpi-soutenance-page .soutenances:fullscreen .room-header .room-header-date,
.tpi-soutenance-page .soutenances:-webkit-full-screen .room-header .room-header-date {
  font-size: 0.88rem;
}

.tpi-soutenance-page .soutenances:fullscreen .room-header .room-header-name,
.tpi-soutenance-page .soutenances:-webkit-full-screen .room-header .room-header-name {
  font-size: 0.96rem;
}

.tpi-soutenance-page .soutenances:fullscreen .tpi-data,
.tpi-soutenance-page .soutenances:-webkit-full-screen .tpi-data {
  padding: 7px;
  gap: 3px;
  border-radius: 8px;
}

.tpi-soutenance-page .soutenances:fullscreen .slot-time,
.tpi-soutenance-page .soutenances:-webkit-full-screen .slot-time {
  min-height: 18px;
  padding: 1px 6px;
  font-size: 0.68rem;
  gap: 5px;
}

.tpi-soutenance-page .soutenances:fullscreen .tpi-row-block,
.tpi-soutenance-page .soutenances:-webkit-full-screen .tpi-row-block {
  padding: 3px 5px;
  column-gap: 6px;
  row-gap: 2px;
  border-radius: 6px;
}

.tpi-soutenance-page .soutenances:fullscreen .slot-value,
.tpi-soutenance-page .soutenances:-webkit-full-screen .slot-value {
  font-size: 0.82rem;
  line-height: 1.2;
}

.tpi-soutenance-page .soutenances:fullscreen .stakeholder-icon,
.tpi-soutenance-page .soutenances:fullscreen .stakeholder-icon-spacer,
.tpi-soutenance-page .soutenances:-webkit-full-screen .stakeholder-icon,
.tpi-soutenance-page .soutenances:-webkit-full-screen .stakeholder-icon-spacer {
  width: 20px;
  height: 20px;
  flex-basis: 20px;
}

.tpi-soutenance-page .soutenances:fullscreen .stakeholder-icon-svg,
.tpi-soutenance-page .soutenances:-webkit-full-screen .stakeholder-icon-svg {
  width: 15px;
  height: 15px;
}

.tpi-soutenance-page .soutenances:fullscreen .soutenance-person-ical,
.tpi-soutenance-page .soutenances:-webkit-full-screen .soutenance-person-ical {
  display: none;
}

.tpi-soutenance-page .soutenance-empty-state {
  width: 100%;
  padding: 18px 16px;
  border: 1px dashed var(--soutenance-border-soft);
  border-radius: var(--soutenance-card-radius);
  background: #fff;
  display: grid;
  gap: 4px;
  box-shadow: var(--soutenance-shadow);
}

.tpi-soutenance-page .soutenance-empty-state p {
  color: var(--soutenance-text-muted);
}

/* Planning (sans scroll horizontal) */
.tpi-soutenance-page .soutenance-time-grid {
  width: 100%;
}

.tpi-soutenance-page .horairesBox {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--soutenance-space-1);
  background: var(--soutenance-surface);
  border: 1px solid var(--soutenance-border-soft);
  border-radius: var(--soutenance-card-radius);
  padding: 8px;
  box-shadow: var(--soutenance-shadow);
}

.tpi-soutenance-page [class^="horaire_"] {
  min-height: 58px;
  border-radius: 10px;
  border: 1px solid var(--soutenance-border-soft);
  padding: 7px 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.tpi-soutenance-page .startTime,
.tpi-soutenance-page .endTime {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.2;
}

/* Liste des salles (grille configurable) */
.tpi-soutenance-page .salles-container {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(var(--soutenance-grid-columns), minmax(0, 1fr));
  align-items: start;
  gap: var(--soutenance-space-3);
}

.tpi-soutenance-page .salle {
  width: 100%;
  border: 1px solid var(--soutenance-border);
  border-radius: var(--soutenance-card-radius);
  background: var(--soutenance-surface-soft);
  box-shadow: var(--soutenance-shadow);
  padding: var(--soutenance-space-2);
  display: grid;
  grid-auto-rows: max-content;
  align-content: start;
  gap: var(--soutenance-space-2);
  overflow: hidden;
  isolation: isolate;
}

.tpi-soutenance-page.is-compact .soutenance-main-area,
.tpi-soutenance-page.is-compact .soutenance-time-grid,
.tpi-soutenance-page.is-compact .salles-container,
.tpi-soutenance-page.is-compact .salle {
  gap: 8px;
}

.tpi-soutenance-page.is-compact .salle {
  padding: 10px;
}

.tpi-soutenance-page.is-compact .room-header .room-header-date {
  font-size: 1rem;
}

.tpi-soutenance-page.is-compact .room-header .room-header-name {
  font-size: 1.08rem;
}

.tpi-soutenance-page.is-compact .room-header {
  --soutenance-room-header-badge-height: 1.05rem;
  --soutenance-room-header-date-height: 0.96rem;
  --soutenance-room-header-title-height: 1.34rem;
}

.tpi-soutenance-page.is-compact .tpi-data {
  padding: 9px;
  gap: 4px;
}

.tpi-soutenance-page.is-compact .slot-time {
  font-size: 0.72rem;
  min-height: 20px;
  padding: 2px 6px;
}

.tpi-soutenance-page.is-compact .slot-role {
  font-size: 0.68rem;
}

.tpi-soutenance-page.is-compact .tpi-row-block {
  padding: 4px 6px;
}

.tpi-soutenance-page.is-compact .slot-value {
  font-size: 0.92rem;
}

.tpi-soutenance-page.is-compact .soutenance-room-class-badge,
.tpi-soutenance-page.is-compact .mobile-site-chip {
  font-size: 0.67rem;
}

.tpi-soutenance-page.is-compact .mobile-tpi-data {
  min-height: 0;
}

.tpi-soutenance-page.is-compact .tpi-room-fiche-link {
  font-size: 0.72rem;
  padding: 3px 8px;
}

.tpi-soutenance-page.is-compact .mobile-room-filter-btn {
  min-height: 34px;
}

.tpi-soutenance-page .salle.ETML {
  border-color: rgba(103, 0, 227, 0.22);
}

.tpi-soutenance-page .salle.CFPV {
  border-color: rgba(222, 32, 146, 0.22);
}

.tpi-soutenance-page .salle.has-soutenance-color {
  border-color: var(--soutenance-room-accent-soft);
}

.tpi-soutenance-page .salle.has-soutenance-color .room-header {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92)),
    var(--soutenance-room-accent-faint);
}

.tpi-soutenance-page .salle.has-soutenance-color .room-header .site,
.tpi-soutenance-page .salle.has-soutenance-color [class^="header_"] {
  background: var(--soutenance-room-accent);
}

.tpi-soutenance-page .room-header {
  display: grid;
  grid-template-rows:
    var(--soutenance-room-header-badge-height)
    var(--soutenance-room-header-date-height)
    var(--soutenance-room-header-title-height);
  align-items: center;
  gap: 0;
  padding: 1px 3px 8px var(--soutenance-space-1);
  position: relative;
  overflow: hidden;
  background: var(--soutenance-surface-soft);
  z-index: 2;
  border-bottom: 1px solid var(--soutenance-border-soft);
  min-height: calc(
    var(--soutenance-room-header-badge-height) + var(--soutenance-room-header-date-height) + var(--soutenance-room-header-title-height) + 12px
  );
  height: calc(
    var(--soutenance-room-header-badge-height) + var(--soutenance-room-header-date-height) + var(--soutenance-room-header-title-height) + 12px
  );
}

.tpi-soutenance-page .tpi-data {
  position: relative;
  z-index: 1;
}

.tpi-soutenance-page .room-header .room-header-date,
.tpi-soutenance-page .room-header .room-header-name {
  margin: 0;
}

.tpi-soutenance-page .room-header .room-header-date {
  grid-row: 2;
  font-size: 1.07rem;
  line-height: var(--soutenance-room-header-date-height);
  height: var(--soutenance-room-header-date-height);
  max-height: var(--soutenance-room-header-date-height);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tpi-soutenance-page .room-header .room-header-name {
  font-size: 1.17rem;
  line-height: var(--soutenance-room-header-title-height);
  height: var(--soutenance-room-header-title-height);
  max-height: var(--soutenance-room-header-title-height);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.tpi-soutenance-page .room-header .site {
  display: inline-flex;
  width: fit-content;
  position: static;
  inset: auto;
  color: #fff;
  font-size: 0.72rem;
  background: #475569;
  border-radius: 999px;
  padding: 1px 9px;
}

.tpi-soutenance-page .room-header-badges {
  grid-row: 1;
  justify-self: end;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: var(--soutenance-room-header-badge-height);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 5px;
  line-height: 1;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
}

.tpi-soutenance-page .room-header-badges .site,
.tpi-soutenance-page .room-header-badges .soutenance-room-class-badge {
  flex: 0 1 auto;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpi-soutenance-page .salle.ETML .room-header .site {
  background: var(--soutenance-accent-etml);
}

.tpi-soutenance-page .salle.CFPV .room-header .site {
  background: var(--soutenance-accent-cfpv);
}

.tpi-soutenance-page .soutenance-room-title-row {
  grid-row: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  position: relative;
  min-height: var(--soutenance-room-header-title-height);
  max-height: var(--soutenance-room-header-title-height);
  height: var(--soutenance-room-header-title-height);
  overflow: hidden;
  width: 100%;
  margin-top: 0;
}

.tpi-soutenance-page .soutenance-room-title-row .room-header-name {
  margin: 0;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  padding-right: 0;
  height: var(--soutenance-room-header-title-height);
  line-height: var(--soutenance-room-header-title-height);
}

.tpi-soutenance-page .soutenance-room-title-row .soutenance-room-class-badge {
  position: static;
  right: auto;
  top: auto;
  transform: none;
  flex: 0 0 auto;
  align-self: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none;
}

.tpi-soutenance-page .soutenance-room-class-badge {
  position: static;
  width: max-content;
  min-height: auto;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  padding: 1px 8px;
  font-size: 0.7rem;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tpi-soutenance-page .soutenance-room-class-badge.is-matu {
  border-color: rgba(14, 165, 233, 0.48);
  background: linear-gradient(135deg, #e0f2fe, #bae6fd);
  color: #0c4a6e;
}

.tpi-soutenance-page .soutenance-room-class-badge.is-special {
  border-color: rgba(245, 158, 11, 0.45);
  background: linear-gradient(135deg, #fef3c7, #fed7aa);
  color: #92400e;
}

.tpi-soutenance-page .soutenance-filtered-export {
  margin-bottom: 2px;
}

.tpi-soutenance-page .btniCal {
  min-height: 30px;
  border-radius: 999px;
  border: 1px solid var(--soutenance-border-soft);
  background: #111827;
  color: #f8fafc;
  font-size: 0.84rem;
  padding: 0 10px;
  cursor: pointer;
  align-self: end;
}

.tpi-soutenance-page .btniCal:disabled,
.tpi-soutenance-page .btniCal:disabled:hover {
  cursor: not-allowed;
  opacity: 0.5;
}

.tpi-soutenance-page .btniCal.btniCal--filtered {
  position: static;
  align-self: start;
}

.tpi-soutenance-page .btniCal.btniCal--room,
.tpi-soutenance-page .btniCal.btniCal--tpi {
  width: 28px;
  min-height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tpi-soutenance-page .btniCal.btniCal--room {
  flex: 0 0 auto;
  align-self: center;
  background: #334155;
}

.tpi-soutenance-page .ical-download-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.tpi-soutenance-page .ical-download-icon-stroke {
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tpi-soutenance-page .soutenance-person-ical {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border: 1px solid var(--soutenance-border-soft);
  border-radius: var(--soutenance-card-radius);
  background: #ffffff;
  box-shadow: var(--soutenance-shadow);
  padding: 12px 14px;
}

.tpi-soutenance-page .soutenance-person-ical p {
  margin: 0;
  color: #334155;
  font-size: 0.9rem;
  font-weight: 600;
}

.tpi-soutenance-page .soutenance-person-ical-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.tpi-soutenance-page .soutenance-person-ical-button {
  min-height: 36px;
  border: 1px solid #1f2937;
  border-radius: 999px;
  background: #111827;
  color: #f8fafc;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.tpi-soutenance-page .soutenance-person-ical-button:hover {
  background: #1f2937;
}

.tpi-soutenance-page .soutenance-person-ical-button:focus-visible {
  outline: 2px solid #0f172a;
  outline-offset: 2px;
}

.tpi-soutenance-page .soutenance-person-ical-button .ical-download-icon {
  width: 16px;
  height: 16px;
}

.tpi-soutenance-page .soutenance-clear-person-filter {
  position: relative;
  width: 36px;
  min-width: 36px;
  min-height: 36px;
  border: 1px solid #fecaca;
  border-radius: 999px;
  background: #fff1f2;
  color: #dc2626;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.tpi-soutenance-page .soutenance-clear-person-filter:hover {
  border-color: #fca5a5;
  background: #fee2e2;
  color: #b91c1c;
}

.tpi-soutenance-page .soutenance-clear-person-filter:focus-visible {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
}

.tpi-soutenance-page .soutenance-clear-person-filter::after {
  content: attr(data-tooltip);
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 20;
  width: max-content;
  max-width: min(250px, 80vw);
  padding: 6px 8px;
  border-radius: 6px;
  background: #111827;
  color: #f8fafc;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.25;
  text-align: left;
  white-space: normal;
  pointer-events: none;
  opacity: 0;
  transform: translateY(3px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.tpi-soutenance-page .soutenance-clear-person-filter:hover::after,
.tpi-soutenance-page .soutenance-clear-person-filter:focus-visible::after {
  opacity: 1;
  transform: translateY(0);
}

.tpi-soutenance-page .clear-person-filter-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.tpi-soutenance-page .clear-person-filter-icon-bg {
  fill: currentColor;
  opacity: 0.12;
}

.tpi-soutenance-page .clear-person-filter-icon-stroke {
  stroke: currentColor;
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Ligne de défense / détails par rôle */
.tpi-soutenance-page .tpi-data {
  width: 100%;
  display: grid;
  gap: var(--soutenance-row-gap);
  border-radius: 10px;
  border: 1px solid var(--soutenance-border-soft);
  background: #ffffff;
  padding: 12px;
  margin: 0;
  transition: border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
}

.tpi-soutenance-page .tpi-data:hover {
  border-color: #cbd5e1;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.tpi-soutenance-page .tpi-data:focus-within,
.tpi-soutenance-page .tpi-data.is-selected {
  border-color: #94a3b8;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(2, 6, 23, 0.06), 0 10px 22px rgba(15, 23, 42, 0.08);
}

.tpi-soutenance-page .tpi-data.is-selected .slot-time {
  border-color: rgba(99, 102, 241, 0.45);
  background: #ede9fe;
  color: #312e81;
}

.tpi-soutenance-page .tpi-data.is-selected .tpi-row-block {
  background: #f8faff;
}

.tpi-soutenance-page .tpi-slot {
  grid-template-rows: auto;
}

.tpi-soutenance-page .slot-time {
  width: 100%;
  min-height: 22px;
  border-radius: 999px;
  border: 1px solid #dbeafe;
  background: #edf2ff;
  color: #312e81;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 3px 8px;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tpi-soutenance-page .slot-time-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tpi-soutenance-page .slot-time-row .slot-time {
  flex: 1 1 auto;
  min-width: 0;
}

.tpi-soutenance-page .slot-time--range {
  justify-content: space-between;
}

.tpi-soutenance-page .slot-time--range span {
  min-width: 0;
}

.tpi-soutenance-page .slot-time-row .btniCal {
  flex-shrink: 0;
}

.tpi-soutenance-page .slot-time--header {
  background: #ffffff;
  border-color: var(--soutenance-border-soft);
  color: var(--soutenance-text-muted);
}

.tpi-soutenance-page .slot-time--empty {
  color: var(--soutenance-text-subtle);
  background: #f8fafc;
  border-color: #e2e8f0;
}

.tpi-soutenance-page .stakeholder-icon {
  --stakeholder-icon-bg: #eef2ff;
  --stakeholder-icon-primary: #6366f1;
  --stakeholder-icon-soft: #c7d2fe;
  --stakeholder-icon-stroke: #312e81;
  width: 25px;
  height: 25px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 25px;
  border-radius: 999px;
  background: var(--stakeholder-icon-bg);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.tpi-soutenance-page .stakeholder-icon-spacer {
  width: 25px;
  height: 25px;
  flex: 0 0 25px;
}

.tpi-soutenance-page .stakeholder-icon-svg {
  --role-icon-primary: var(--stakeholder-icon-primary);
  --role-icon-soft: var(--stakeholder-icon-soft);
  --role-icon-stroke: var(--stakeholder-icon-stroke);
  width: 19px;
  height: 19px;
  display: block;
}

.tpi-soutenance-page .stakeholder-icon--expert1,
.tpi-soutenance-page .stakeholder-icon--expert2 {
  --stakeholder-icon-bg: #fef9c3;
  --stakeholder-icon-primary: #facc15;
  --stakeholder-icon-soft: #fef08a;
  --stakeholder-icon-stroke: #854d0e;
}

.tpi-soutenance-page .stakeholder-icon--projectManager {
  --stakeholder-icon-bg: #fee2e2;
  --stakeholder-icon-primary: #ef4444;
  --stakeholder-icon-soft: #fecaca;
  --stakeholder-icon-stroke: #7f1d1d;
}

.tpi-soutenance-page .stakeholder-icon--visual-candidate {
  --stakeholder-icon-bg: #dbeafe;
  --stakeholder-icon-primary: #3b82f6;
  --stakeholder-icon-soft: #bfdbfe;
  --stakeholder-icon-stroke: #1e40af;
}

.tpi-soutenance-page .stakeholder-icon--visual-candidate-green {
  --stakeholder-icon-bg: #dcfce7;
  --stakeholder-icon-primary: #22c55e;
  --stakeholder-icon-soft: #bbf7d0;
  --stakeholder-icon-stroke: #166534;
}

.tpi-soutenance-page .stakeholder-icon--visual-candidate-violet {
  --stakeholder-icon-bg: #ede9fe;
  --stakeholder-icon-primary: #8b5cf6;
  --stakeholder-icon-soft: #ddd6fe;
  --stakeholder-icon-stroke: #5b21b6;
}

.tpi-soutenance-page .stakeholder-icon--visual-candidate-rose {
  --stakeholder-icon-bg: #fce7f3;
  --stakeholder-icon-primary: #ec4899;
  --stakeholder-icon-soft: #fbcfe8;
  --stakeholder-icon-stroke: #9d174d;
}

.tpi-soutenance-page .stakeholder-icon--visual-candidate-gold {
  --stakeholder-icon-bg: #fef3c7;
  --stakeholder-icon-primary: #f59e0b;
  --stakeholder-icon-soft: #fde68a;
  --stakeholder-icon-stroke: #92400e;
}

.tpi-soutenance-page .stakeholder-icon--visual-helmet-orange {
  --stakeholder-icon-bg: #ffedd5;
  --stakeholder-icon-primary: #f97316;
  --stakeholder-icon-soft: #fed7aa;
  --stakeholder-icon-stroke: #9a3412;
}

.tpi-soutenance-page .stakeholder-icon--visual-helmet-green {
  --stakeholder-icon-bg: #dcfce7;
  --stakeholder-icon-primary: #22c55e;
  --stakeholder-icon-soft: #bbf7d0;
  --stakeholder-icon-stroke: #166534;
}

.tpi-soutenance-page .stakeholder-icon--visual-helmet-blue {
  --stakeholder-icon-bg: #dbeafe;
  --stakeholder-icon-primary: #3b82f6;
  --stakeholder-icon-soft: #bfdbfe;
  --stakeholder-icon-stroke: #1e40af;
}

.tpi-soutenance-page .stakeholder-icon--visual-helmet-black {
  --stakeholder-icon-bg: #e5e7eb;
  --stakeholder-icon-primary: #111827;
  --stakeholder-icon-soft: #9ca3af;
  --stakeholder-icon-stroke: #020617;
}

.tpi-soutenance-page .stakeholder-icon--visual-helmet-gray {
  --stakeholder-icon-bg: #f1f5f9;
  --stakeholder-icon-primary: #64748b;
  --stakeholder-icon-soft: #cbd5e1;
  --stakeholder-icon-stroke: #334155;
}

.tpi-soutenance-page .tpi-slot.is-slot-empty {
  border-style: dashed;
  border-color: #d8e2ef;
}

.tpi-soutenance-page .tpi-slot.is-slot-empty .slot-row--empty {
  background: transparent;
  grid-template-columns: minmax(0, 1fr);
  min-height: 31px;
}

.tpi-soutenance-page .tpi-slot.is-slot-empty .slot-value {
  color: #94a3b8;
}

.tpi-soutenance-page .tpi-slot.is-slot-empty .slot-value:empty::after {
  content: "";
}

.tpi-soutenance-page .tpi-row-block {
  display: grid;
  grid-template-columns: minmax(var(--soutenance-grid-label-min), 112px) minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto);
  align-items: center;
  column-gap: 8px;
  row-gap: 4px;
  padding: 5px 6px;
  border-radius: 8px;
  background: #fcfdff;
}

.tpi-soutenance-page .tpi-row-block--candidate {
  grid-template-columns: minmax(0, 1fr) auto;
  background: #eef2ff;
  border: 1px solid #dbeafe;
}

.tpi-soutenance-page .tpi-row-block--candidate .slot-value {
  text-align: center;
}

.tpi-soutenance-page .tpi-row-block--candidate .slot-value .nameTpi,
.tpi-soutenance-page .tpi-row-block--candidate .slot-value .truncated-text {
  justify-content: center;
}

.tpi-soutenance-page .slot-role {
  color: var(--soutenance-text-muted);
  font-weight: 700;
  font-size: 0.72rem;
  border-radius: var(--soutenance-pill-radius);
  background: #f8fafc;
  border: 1px solid var(--soutenance-border-soft);
  padding: 1px 8px;
  width: fit-content;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.tpi-soutenance-page .salle > .room-header .room-header-date,
.tpi-soutenance-page .salle > .room-header .room-header-name {
  text-rendering: optimizeLegibility;
}

.tpi-soutenance-page .slot-value {
  min-width: 0;
  color: #0f172a;
  line-height: 1.35;
}

.tpi-soutenance-page .slot-value .nameTpi,
.tpi-soutenance-page .slot-value .truncated-text {
  display: inline-flex;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tpi-soutenance-page .slot-value:empty::after {
  content: "—";
  color: #9ca3af;
}

.tpi-soutenance-page .tpi-row-block .action-buttons {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tpi-soutenance-page .action-buttons button {
  border: none;
  background: transparent;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.tpi-soutenance-page .action-buttons button:hover {
  transform: translateY(-1px);
}

.tpi-soutenance-page .action-buttons button svg {
  width: 16px;
  height: 16px;
  display: block;
}

.tpi-soutenance-page .action-buttons button:disabled,
.tpi-soutenance-page .action-buttons button:disabled:hover {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.tpi-soutenance-page .tpi-row-block.is-dim {
  opacity: 0.5;
}

.tpi-soutenance-page .tpi-row-block.is-focus {
  border-left: 3px solid #22c55e;
  padding-left: 8px;
}

.tpi-soutenance-page .tpi-data.tpi-slot.is-filterless {
  border: 1px dashed var(--soutenance-border-soft);
}

.tpi-soutenance-page .mobile-room-filter-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 4px var(--soutenance-space-1);
}

.tpi-soutenance-page .mobile-site-chip {
  display: inline-flex;
  width: fit-content;
  padding: 3px 10px;
  border-radius: 999px;
  color: #fff;
  background: #475569;
  font-size: 0.74rem;
  font-weight: 700;
}

.tpi-soutenance-page .mobile-room-counter {
  color: var(--soutenance-text-subtle);
  font-size: 0.76rem;
  white-space: nowrap;
  font-weight: 700;
}

/* États couleur des boutons d’action */
.button-true {
  color: #00a63e;
  font-weight: 700;
}

.button-false {
  color: #e11d48;
  font-weight: 700;
}

.button-null {
  color: #334155;
}

.button-has-values,
.button-proposition-values {
  color: #2563eb;
}

.button-empty {
  color: #94a3b8;
}

.button-accept-ok {
  color: #16a34a;
}

.button-accept-x {
  color: #dc2626;
}

.button-proposition-emoji {
  font-size: 20px;
}

/* Mobile */
.tpi-soutenance-page .message-smartphone {
  background: #dc2626;
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  text-align: center;
}

.tpi-soutenance-page .filters-smartphone {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.tpi-soutenance-page button.smartphone {
  height: 44px;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 700;
  padding: 0 12px;
  background: var(--soutenance-accent-cfpv);
}

.tpi-soutenance-page button.smartphone:nth-child(even) {
  background: var(--soutenance-accent-etml);
}

.tpi-soutenance-page .mobile-mes-tpi,
.tpi-soutenance-page .mobile-room-filter,
.tpi-soutenance-page .salles-container-smartphone {
  display: grid;
  gap: var(--soutenance-space-2);
}

.tpi-soutenance-page .mobile-room-filter-btn {
  width: 100%;
  border: 1px solid var(--soutenance-border-soft);
  border-radius: 999px;
  background: #f1f5f9;
  min-height: 38px;
  color: #0f172a;
  font-weight: 700;
}

.tpi-soutenance-page .mobile-room-filter-nav {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: var(--soutenance-space-1);
}

.tpi-soutenance-page .mobile-room-filter-counter {
  font-size: 0.8rem;
  color: var(--soutenance-text-subtle);
  text-align: center;
  font-weight: 700;
}

.tpi-soutenance-page .soutenance-mobile-head {
  margin-bottom: 8px;
}

.tpi-soutenance-page .soutenance-mobile-head .title {
  margin: 0;
}

.tpi-soutenance-page .mobile-tpi-data {
  min-height: 118px;
}

.tpi-soutenance-page .tpi-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tpi-soutenance-page .tpi-entry {
  display: grid;
  grid-template-columns: minmax(70px, 80px) minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  min-height: 24px;
}

.tpi-soutenance-page .tpi-entry.tpi-candidat {
  display: block;
  font-weight: 700;
  line-height: 1.35;
  font-size: 0.93rem;
}

.tpi-soutenance-page .tpi-container--empty .tpi-entry--empty {
  min-height: 24px;
}

.tpi-soutenance-page.is-compact .tpi-entry {
  grid-template-columns: minmax(66px, 76px) minmax(0, 1fr);
  gap: 3px;
}

.tpi-soutenance-page.is-compact .tpi-entry.tpi-candidat {
  font-size: 0.86rem;
}

.tpi-soutenance-page .tpi-expert1,
.tpi-soutenance-page .tpi-expert2,
.tpi-soutenance-page .tpi-boss {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tpi-soutenance-page [class^="header_"] {
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: var(--soutenance-accent-etml);
  color: #fff;
  padding: 4px 8px;
  margin: 0;
  display: grid;
  grid-template-rows: 1.2rem 1.25rem;
  gap: 0;
  overflow: hidden;
  position: relative;
  z-index: 2;
  border-bottom: 1px solid rgba(2, 6, 23, 0.14);
}

.tpi-soutenance-page [class^="header_"] .room-header-date,
.tpi-soutenance-page [class^="header_"] .room-header-name,
.tpi-soutenance-page [class^="header_"] .soutenance-room-title-row {
  margin: 0;
  padding: 0;
}

.tpi-soutenance-page [class^="header_"] .room-header-date {
  font-size: 1.07rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 1.17rem;
}

.tpi-soutenance-page [class^="header_"] .soutenance-room-title-row .room-header-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25rem;
  height: 1.25rem;
  min-height: 1.25rem;
  max-height: 1.25rem;
  padding-right: 56px;
}

.tpi-soutenance-page .header_:first-child {
  margin-top: 0;
}

.tpi-soutenance-page .time-label {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
  color: #334155;
}

.tpi-soutenance-page .tpi-room-fiche-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  margin-top: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: lowercase;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.78rem;
  background: #e2e8f0;
  color: #0f172a;
}

.tpi-soutenance-page .tpi-room-fiche-link:hover {
  background: #cbd5e1;
}

.tpi-soutenance-page .tpi-room-fiche-link:focus-visible {
  outline: 2px solid #0f172a;
  outline-offset: 2px;
}

/* Popup creneau */
.tpi-soutenance-page .popup-container {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(700px, 92vw);
  max-height: 90vh;
  overflow: auto;
  background: #fff;
  box-shadow: var(--soutenance-shadow);
  border-radius: 12px;
  padding: 18px;
  z-index: 20;
}

.tpi-soutenance-page .popup {
  display: flex;
  flex-direction: column;
}

.tpi-soutenance-page .popup h3 {
  margin-top: 0;
}

.tpi-soutenance-page .popup input[type="date"],
.tpi-soutenance-page .popup select {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 10px;
  border: 1px solid var(--soutenance-border-soft);
}

.tpi-soutenance-page .popup button {
  border: none;
  border-radius: 10px;
  min-height: 38px;
  padding: 0 16px;
  color: #fff;
  background: var(--soutenance-accent-etml);
  cursor: pointer;
}

.tpi-soutenance-page .popup button:hover {
  filter: brightness(0.95);
}

.tpi-soutenance-page .popup button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Classes d’alignement précédemment utilisées */
.tpi-soutenance-page .header-row,
.tpi-soutenance-page .welcom,
.tpi-soutenance-page .no-filter {
  display: none;
}

.tpi-soutenance-page .site {
  display: none;
}

.tpi-soutenance-page .room-header .site,
.tpi-soutenance-page .mobile-site-chip {
  display: inline-flex;
}

/* Impression */
@media print {
  .tpi-soutenance-page {
    padding: 0;
  }

  @page {
    size: A4;
    margin: 8mm;
  }

  .tpi-soutenance-page .smartphone,
  .tpi-soutenance-page .soutenance-toolbar-filters,
  .tpi-soutenance-page .btnFilters,
  .tpi-soutenance-page .btnPrint,
  .tpi-soutenance-page .mobile-room-filter-btn,
  .tpi-soutenance-page .btniCal,
  .tpi-soutenance-page .message-smartphone,
  .tpi-soutenance-page .soutenance-focus-banner {
    display: none !important;
  }

  .tpi-soutenance-page .horairesBox,
  .tpi-soutenance-page .action-buttons {
    display: none;
  }

  .tpi-soutenance-page .salles-container,
  .tpi-soutenance-page .salle {
    display: block;
    box-shadow: none;
  }

  .tpi-soutenance-page .salle {
    break-inside: avoid;
    margin-bottom: 12px;
    border: 1px solid #cbd5e1;
  }
}

@media (max-width: 767px) {
  .tpi-soutenance-page {
    padding-left: 10px;
    padding-right: 10px;
  }

  .tpi-soutenance-page .soutenance-toolbar-filters {
    display: grid;
    grid-template-columns: 1fr;
    overflow: visible;
    padding-bottom: 0;
  }

  .tpi-soutenance-page .soutenance-filter-actions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .tpi-soutenance-page .soutenance-filter-block select,
  .tpi-soutenance-page .soutenance-filter-actions .btnFilters {
    width: 100%;
  }

  .tpi-soutenance-page .tpi-row-block {
    grid-template-columns: minmax(64px, 76px) minmax(0, 1fr);
  }

  .tpi-soutenance-page .tpi-row-block .action-buttons {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .tpi-soutenance-page .soutenance-time-grid {
    overflow: hidden;
  }

  .tpi-soutenance-page .soutenance-main-area,
  .tpi-soutenance-page .salles-container {
    width: 100%;
    overflow: visible;
  }
}

@media (max-width: 360px) {
  .tpi-soutenance-page {
    --soutenance-space-1: 6px;
    --soutenance-space-2: 10px;
    --soutenance-space-3: 13px;
    --soutenance-page-gutter-inline: 8px;
  }

  .tpi-soutenance-page .title,
  .tpi-soutenance-page .demo {
    font-size: clamp(1.23rem, 6vw, 1.48rem);
  }

  .tpi-soutenance-page .room-header .room-header-date {
    font-size: 0.94rem;
  }

  .tpi-soutenance-page .room-header .room-header-name {
    font-size: 1.02rem;
  }

  .tpi-soutenance-page .time-label {
    font-size: 0.74rem;
  }

  .tpi-soutenance-page .slot-time {
    font-size: 0.7rem;
    padding: 2px 6px;
  }

  .tpi-soutenance-page .slot-role {
    font-size: 0.67rem;
  }
}

@media (min-width: 361px) and (max-width: 390px) {
  .tpi-soutenance-page {
    --soutenance-space-1: 7px;
    --soutenance-space-2: 11px;
    --soutenance-space-3: 15px;
    --soutenance-page-gutter-inline: 9px;
  }
}

@media (min-width: 391px) and (max-width: 768px) {
  .tpi-soutenance-page {
    --soutenance-space-1: 8px;
    --soutenance-space-2: 12px;
    --soutenance-space-3: 16px;
    --soutenance-page-gutter-inline: 11px;
  }

  .tpi-soutenance-page .title,
  .tpi-soutenance-page .demo {
    font-size: clamp(1.45rem, 7vw, 1.8rem);
  }

  .tpi-soutenance-page .tpi-data {
    padding: 11px;
  }
}


:root {
  --app-page-width: 1840px;
  --app-ui-font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
  --app-border: #dbe4ee;
  --app-border-soft: #dce9ff;
  --app-surface: #ffffff;
  --app-text-main: #0f172a;
  --app-text-muted: #4b5563;
  --app-shadow-card: 0 10px 24px rgba(15, 23, 42, 0.08);
  --room-padding-top: 0px;
}

body {
  margin: 0;
  background: #f5f7fb;
}

.tpi-soutenance-page.static-soutenance-page {
  padding-top: var(--soutenance-space-3);
}

.static-soutenance-page .soutenance-toolbar-hero-content {
  max-width: min(100%, 860px);
}

.static-soutenance-page .static-hero-pdf-action {
  min-width: 56px;
  min-height: 34px;
  width: auto;
  height: 36px;
  padding: 0 12px;
  border: 2px solid rgba(248, 250, 252, 0.86);
  border-radius: 999px;
  background: #ffffff;
  color: #1d4ed8;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
  cursor: pointer;
}

.static-soutenance-page .static-hero-pdf-action:hover {
  background: #ffffff;
  filter: brightness(0.96);
  transform: translateY(-1px);
}

.static-soutenance-page .static-role-letter {
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1;
  color: var(--stakeholder-icon-stroke);
}

.static-soutenance-page .soutenance-filter-actions {
  min-width: 0;
}

.static-soutenance-page .static-filter-result {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.static-soutenance-page .static-hidden {
  display: none !important;
}

</style>
</head>
<body>
  <div class="tpi-soutenance-page static-soutenance-page">
    <header class="soutenance-toolbar">
      <div class="soutenance-toolbar-head soutenance-toolbar-hero has-fullscreen-action">
        <div class="soutenance-toolbar-hero-content">
          <div class="title">Défenses 2026</div>
          <p class="soutenance-toolbar-greeting">Version statique publiée pour consultation.</p>
          <span class="static-filter-result" id="result-count"></span>
        </div>
        <button
          type="button"
          class="soutenance-hero-fullscreen-action static-hero-pdf-action"
          id="static-print"
          title="Imprimer la page"
          aria-label="Imprimer la page"
        >PDF</button>
      </div>
    </header>

    <section class="soutenance-focus-banner static-hidden" id="focus-banner">
      <div>
        <strong id="focus-title"></strong>
        <p id="focus-text"></p>
      </div>
    </section>

    <div id="soutenances" class="soutenances">
      <section class="soutenance-main-area">
        <div class="soutenance-empty-state static-hidden" id="empty-state">
          <strong>Aucune défense à afficher.</strong>
          <p>Aucun résultat pour ces filtres.</p>
        </div>
        <div
          id="rooms"
          class="salles-container"
          role="list"
          aria-label="Liste des salles"
          style="--soutenance-grid-columns: 4;"
        ></div>
      </section>
    </div>

    <section class="soutenance-person-ical static-hidden" id="static-person-ical">
      <p>Télécharger votre iCal pour insérer vos défenses dans votre agenda Outlook.</p>
      <div class="soutenance-person-ical-actions">
        <button
          type="button"
          class="soutenance-person-ical-button"
          id="static-person-ical-download"
          aria-label="Télécharger votre iCal Outlook"
          disabled
        >
          <span id="static-person-ical-label">Télécharger votre iCal</span>
        </button>
      </div>
    </section>
  </div>

  <script id="defense-data" type="application/json">{"year":2026,"generatedAt":"2026-05-02T06:52:22.532Z","rooms":[{"idRoom":390069011,"lastUpdate":1777704729046,"site":"VENNES","date":"2026-06-04T00:00:00.000Z","name":"Vennes - B23","roomClassMode":"matu","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-04_0","period":1,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-10","id":"VENNES_Vennes - B23_2026-06-04_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Amstutz Gabriele","candidatPersonId":"69ddfbf8e910b6872d05c8aa","expert1":{"name":"Carlos Perez","personId":"69dbb567d9434724eaa11246","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Michel Ange Delgado","personId":"69dbb567d9434724eaa11273","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Karim Bourahla","personId":"69dbb567d9434724eaa11261","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-11","id":"VENNES_Vennes - B23_2026-06-04_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Diezi Valentin","candidatPersonId":"69ddfbf8e910b6872d05c895","expert1":{"name":"Daniel Berney","personId":"69dbb567d9434724eaa1124c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Jason Crisante","personId":"69dbb567d9434724eaa1125b","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Karim Bourahla","personId":"69dbb567d9434724eaa11261","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-32","id":"VENNES_Vennes - B23_2026-06-04_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Berchel Joachim Siméon Gabrie","candidatPersonId":"69f34bc12532dd27fd9f8357","expert1":{"name":"Isabelle Stucki","personId":"69dbc07289ecf04f841001f7","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Pascal Benzonana","personId":"69dbb567d9434724eaa1127f","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Aurélie Curchod","personId":"69dbc07289ecf04f84100234","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":"TPI-2026-37","id":"VENNES_Vennes - B23_2026-06-04_4","period":5,"startTime":"12:40","endTime":"13:40","candidat":"Simões Pólvora Luc","candidatPersonId":"69e50ad49c07587649d6ac67","expert1":{"name":"Serge Wenger","personId":"69dbb567d9434724eaa11288","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Michael Wyssa","personId":"69dbb567d9434724eaa11270","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Jonathan Melly","personId":"69dbc07289ecf04f84100231","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":"TPI-2026-35","id":"VENNES_Vennes - B23_2026-06-04_5","period":6,"startTime":"13:50","endTime":"14:50","candidat":"Nardou Thomas Louis","candidatPersonId":"69ddfbf8e910b6872d05c907","expert1":{"name":"Nicolas Borboën","personId":"69dbb567d9434724eaa11279","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Michael Wyssa","personId":"69dbb567d9434724eaa11270","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Jonathan Melly","personId":"69dbc07289ecf04f84100231","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-04_6","period":7,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-04_7","period":8,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"jeu., 04.06.2026","classLabel":"MATU","classBadgeClass":"is-matu","classFilterValue":"matu","roomClassName":"","roomStyle":{}}},{"idRoom":390069010,"lastUpdate":1777704729048,"site":"VENNES","date":"2026-06-05T00:00:00.000Z","name":"Vennes - B23","roomClassMode":"matu","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-05_0","period":1,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-36","id":"VENNES_Vennes - B23_2026-06-05_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Rodrigues Sousa Tiago","candidatPersonId":"69ddfbf8e910b6872d05c8ef","expert1":{"name":"Nicolas Borboën","personId":"69dbb567d9434724eaa11279","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Pascal Benzonana","personId":"69dbb567d9434724eaa1127f","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Cédric Schaffter","personId":"69dbc07289ecf04f8410020c","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-34","id":"VENNES_Vennes - B23_2026-06-05_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Lordon Lucas","candidatPersonId":"69ddfbf8e910b6872d05c8d7","expert1":{"name":"Olivier Mellina","personId":"69dbb567d9434724eaa1127c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Mikael Gonzalez","personId":"69dbb567d9434724eaa11276","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Cédric Schaffter","personId":"69dbc07289ecf04f8410020c","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-12","id":"VENNES_Vennes - B23_2026-06-05_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Roudet Alexy Julien","candidatPersonId":"69ddfbf8e910b6872d05c8c2","expert1":{"name":"Alexandre Graf","personId":"69dbb567d9434724eaa1123a","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Jason Crisante","personId":"69dbb567d9434724eaa1125b","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Guillaume Blanco","personId":"69dbc07289ecf04f84100217","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-05_4","period":5,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-05_5","period":6,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-05_6","period":7,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":null,"id":"VENNES_Vennes - B23_2026-06-05_7","period":8,"startTime":"","endTime":"","candidat":"","expert1":{"name":"","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"ven., 05.06.2026","classLabel":"MATU","classBadgeClass":"is-matu","classFilterValue":"matu","roomClassName":"","roomStyle":{}}},{"idRoom":13593078,"lastUpdate":1777704729048,"site":"VENNES","date":"2026-06-10T00:00:00.000Z","name":"Vennes - A22","roomClassMode":"nonM","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":"TPI-2026-29","id":"VENNES_Vennes - A22_2026-06-10_0","period":1,"startTime":"8:00","endTime":"9:00","candidat":"Paramanathan Evin","candidatPersonId":"69e50ad49c07587649d6ac4b","expert1":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Gael Sonney","personId":"69dbc07289ecf04f84100240","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-15","id":"VENNES_Vennes - A22_2026-06-10_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Jotterand Timothy","candidatPersonId":"69e5093b9c07587649d6ac13","expert1":{"name":"Claude-Albert Muller Theurillat","personId":"69dbb567d9434724eaa11249","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Romain Rosay","personId":"69dbc07289ecf04f8410021a","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-31","id":"VENNES_Vennes - A22_2026-06-10_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Toledo Campoverde Adrian Federico","candidatPersonId":"69f34bc12532dd27fd9f8371","expert1":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Ernesto Montemayor","personId":"69dbb567d9434724eaa11252","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Pascal Piot","personId":"69dbc07289ecf04f84100237","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-42","id":"VENNES_Vennes - A22_2026-06-10_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Fleurdelys Brendan","candidatPersonId":"69f34bc12532dd27fd9f8363","expert1":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Ernesto Montemayor","personId":"69dbb567d9434724eaa11252","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Xavier Carrel","personId":"69dbc07289ecf04f8410022c","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":"TPI-2026-39","id":"VENNES_Vennes - A22_2026-06-10_4","period":5,"startTime":"12:40","endTime":"13:40","candidat":"Bartou Rayan","candidatPersonId":"69ddfbfae910b6872d05ca66","expert1":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Claude-Albert Muller Theurillat","personId":"69dbb567d9434724eaa11249","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Alain Garraux","personId":"69dbc07289ecf04f84100200","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":"TPI-2026-43","id":"VENNES_Vennes - A22_2026-06-10_5","period":6,"startTime":"13:50","endTime":"14:50","candidat":"Grisales Betancur Jessica","candidatPersonId":"69ddfbfae910b6872d05caa8","expert1":{"name":"Claude-Albert Muller Theurillat","personId":"69dbb567d9434724eaa11249","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Alain Garraux","personId":"69dbc07289ecf04f84100200","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":"TPI-2026-50","id":"VENNES_Vennes - A22_2026-06-10_6","period":7,"startTime":"15:00","endTime":"16:00","candidat":"Rodrigues Lopes Diogo Filipe","candidatPersonId":"69ddfbfae910b6872d05cabd","expert1":{"name":"Claude-Albert Muller Theurillat","personId":"69dbb567d9434724eaa11249","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Alain Garraux","personId":"69dbc07289ecf04f84100200","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":"TPI-2026-52","id":"VENNES_Vennes - A22_2026-06-10_7","period":8,"startTime":"16:10","endTime":"17:10","candidat":"Sousa Francisco","candidatPersonId":"69e50ad59c07587649d6ac6e","expert1":{"name":"Volkan Sutcu","personId":"69dbb567d9434724eaa11291","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Xavier Carrel","personId":"69dbc07289ecf04f8410022c","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"mer., 10.06.2026","classLabel":"","classBadgeClass":"","classFilterValue":"noBadge","roomClassName":"","roomStyle":{}}},{"idRoom":115489641,"lastUpdate":1777704729049,"site":"VENNES","date":"2026-06-10T00:00:00.000Z","name":"Vennes - A23","roomClassMode":"nonM","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":"TPI-2026-17","id":"VENNES_Vennes - A23_2026-06-10_0","period":1,"startTime":"8:00","endTime":"9:00","candidat":"Metroz Quenti","candidatPersonId":"69ddfbf9e910b6872d05c985","expert1":{"name":"Luc Venries","personId":"69dbb567d9434724eaa11264","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Diego Criscenti","personId":"69dbb567d9434724eaa1124f","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Dimitrios Lymberis","personId":"69dbc07289ecf04f84100203","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-16","id":"VENNES_Vennes - A23_2026-06-10_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Lopardo Alessio","candidatPersonId":"69ddfbfae910b6872d05ca4e","expert1":{"name":"Luc Venries","personId":"69dbb567d9434724eaa11264","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Grégory Charmier","personId":"69dbc07289ecf04f84100229","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-26","id":"VENNES_Vennes - A23_2026-06-10_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Khalil Mateen Salem","candidatPersonId":"69ddfbf9e910b6872d05c9df","expert1":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Sofia Roy","personId":"69dbb567d9434724eaa1128b","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Antoine Mveng Evina","personId":"69dbc07289ecf04f8410023a","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-23","id":"VENNES_Vennes - A23_2026-06-10_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Zarrabi Nima Amir Aram","candidatPersonId":"69e50ad59c07587649d6ac7c","expert1":{"name":"Serge Wenger","personId":"69dbb567d9434724eaa11288","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Volkan Sutcu","personId":"69dbb567d9434724eaa11291","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Helder Manuel Costa Lopes","personId":"69dbc07289ecf04f841001fa","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":"TPI-2026-18","id":"VENNES_Vennes - A23_2026-06-10_4","period":5,"startTime":"12:40","endTime":"13:40","candidat":"Moia Luke","candidatPersonId":"69ddfbf9e910b6872d05c931","expert1":{"name":"Serge Wenger","personId":"69dbb567d9434724eaa11288","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Ernesto Montemayor","personId":"69dbb567d9434724eaa11252","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Dimitrios Lymberis","personId":"69dbc07289ecf04f84100203","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":"TPI-2026-27","id":"VENNES_Vennes - A23_2026-06-10_5","period":6,"startTime":"13:50","endTime":"14:50","candidat":"Mares Julien Pierre","candidatPersonId":"69ddfbf9e910b6872d05c946","expert1":{"name":"Serge Wenger","personId":"69dbb567d9434724eaa11288","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Ernesto Montemayor","personId":"69dbb567d9434724eaa11252","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Dimitrios Lymberis","personId":"69dbc07289ecf04f84100203","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":"TPI-2026-41","id":"VENNES_Vennes - A23_2026-06-10_6","period":7,"startTime":"15:00","endTime":"16:00","candidat":"Essayas Meron","candidatPersonId":"69ddfbfae910b6872d05cad2","expert1":{"name":"Suleyman Ceran","personId":"69dbb567d9434724eaa1128e","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Volkan Sutcu","personId":"69dbb567d9434724eaa11291","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Alain Girardet","personId":"69ddfbfae910b6872d05cadb","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":"TPI-2026-6","id":"VENNES_Vennes - A23_2026-06-10_7","period":8,"startTime":"16:10","endTime":"17:10","candidat":"Pages Marius","candidatPersonId":"69ddfbf9e910b6872d05ca24","expert1":{"name":"Carlos Perez","personId":"69dbb567d9434724eaa11246","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Jean-Luc Roduit","personId":"69dbb567d9434724eaa1125e","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Romain Rosay","personId":"69dbc07289ecf04f8410021a","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"mer., 10.06.2026","classLabel":"","classBadgeClass":"","classFilterValue":"noBadge","roomClassName":"","roomStyle":{}}},{"idRoom":648234422,"lastUpdate":1777704729045,"site":"VENNES","date":"2026-06-10T00:00:00.000Z","name":"Vennes - B21","roomClassMode":"nonM","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":"TPI-2026-49","id":"VENNES_Vennes - B21_2026-06-10_0","period":1,"startTime":"8:00","endTime":"9:00","candidat":"Ristic Christopher","candidatPersonId":"69ddfbfae910b6872d05cb45","expert1":{"name":"Alexandre Graf","personId":"69dbb567d9434724eaa1123a","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Raphaël Favre","personId":"69dbb567d9434724eaa11282","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Pascal Piot","personId":"69dbc07289ecf04f84100237","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-9","id":"VENNES_Vennes - B21_2026-06-10_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Wu Guoxu","candidatPersonId":"69ddfbfae910b6872d05ca39","expert1":{"name":"Alexandre Graf","personId":"69dbb567d9434724eaa1123a","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Sofia Roy","personId":"69dbb567d9434724eaa1128b","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Sheyla Oliveira Kobi","personId":"69dbc07289ecf04f841001fd","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-5","id":"VENNES_Vennes - B21_2026-06-10_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Moser Even Gavrie","candidatPersonId":"69ddfbf9e910b6872d05ca0f","expert1":{"name":"Arnaud Sartoni","personId":"69dbb567d9434724eaa1123d","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Max Roy","personId":"69dbb567d9434724eaa1126d","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Sheyla Oliveira Kobi","personId":"69dbc07289ecf04f841001fd","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-8","id":"VENNES_Vennes - B21_2026-06-10_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Tecle Siem Biniam","candidatPersonId":"69ddfbfae910b6872d05ca93","expert1":{"name":"Jean-Luc Roduit","personId":"69dbb567d9434724eaa1125e","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Arnaud Sartoni","personId":"69dbb567d9434724eaa1123d","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Alexis Gugler","personId":"69dbc07289ecf04f841001f4","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":"TPI-2026-22","id":"VENNES_Vennes - B21_2026-06-10_4","period":5,"startTime":"12:40","endTime":"13:40","candidat":"Velickovic Mateja","candidatPersonId":"69ddfbf9e910b6872d05c99a","expert1":{"name":"Jean-Luc Roduit","personId":"69dbb567d9434724eaa1125e","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Gabriel Maret","personId":"69dbb567d9434724eaa11258","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Mathieu Meylan","personId":"69dbc07289ecf04f84100206","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":"TPI-2026-1","id":"VENNES_Vennes - B21_2026-06-10_5","period":6,"startTime":"13:50","endTime":"14:50","candidat":"Al Hussein Mussa","candidatPersonId":"69ddfbf9e910b6872d05c95b","expert1":{"name":"Carlos Perez","personId":"69dbb567d9434724eaa11246","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Max Roy","personId":"69dbb567d9434724eaa1126d","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Guillaume Blanco","personId":"69dbc07289ecf04f84100217","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":"TPI-2026-3","id":"VENNES_Vennes - B21_2026-06-10_6","period":7,"startTime":"15:00","endTime":"16:00","candidat":"Gligorijevic Nikola","candidatPersonId":"69ddfbf9e910b6872d05c9f7","expert1":{"name":"Alexandre Graf","personId":"69dbb567d9434724eaa1123a","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Carlos Perez","personId":"69dbb567d9434724eaa11246","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Sheyla Oliveira Kobi","personId":"69dbc07289ecf04f841001fd","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":"TPI-2026-45","id":"VENNES_Vennes - B21_2026-06-10_7","period":8,"startTime":"16:10","endTime":"17:10","candidat":"Morier Mina","candidatPersonId":"69ddfbfae910b6872d05cb17","expert1":{"name":"Nicolas Borboën","personId":"69dbb567d9434724eaa11279","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Diego Criscenti","personId":"69dbb567d9434724eaa1124f","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Mathieu Meylan","personId":"69dbc07289ecf04f84100206","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"mer., 10.06.2026","classLabel":"","classBadgeClass":"","classFilterValue":"noBadge","roomClassName":"","roomStyle":{}}},{"idRoom":519151703,"lastUpdate":1777704729050,"site":"VENNES","date":"2026-06-10T00:00:00.000Z","name":"Vennes - B22","roomClassMode":"nonM","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":"TPI-2026-53","id":"VENNES_Vennes - B22_2026-06-10_0","period":1,"startTime":"8:00","endTime":"9:00","candidat":"Gabriel Sauge","candidatPersonId":"69ddfbfae910b6872d05cb30","expert1":{"name":"Daniel Berney","personId":"69dbb567d9434724eaa1124c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Arnaud Sartoni","personId":"69dbb567d9434724eaa1123d","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Isabelle Stucki","personId":"69dbc07289ecf04f841001f7","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-7","id":"VENNES_Vennes - B22_2026-06-10_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Rouwenhorst Timo Albert","candidatPersonId":"69e50ad49c07587649d6ac59","expert1":{"name":"Jean-Luc Roduit","personId":"69dbb567d9434724eaa1125e","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Karim Bourahla","personId":"69dbb567d9434724eaa11261","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Cédric Kind","personId":"69dbc07289ecf04f84100220","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-4","id":"VENNES_Vennes - B22_2026-06-10_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Mohamed Zarook Mohamed Zaahid","candidatPersonId":"69ddfbf9e910b6872d05c9ca","expert1":{"name":"Jean-Luc Roduit","personId":"69dbb567d9434724eaa1125e","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Jason Crisante","personId":"69dbb567d9434724eaa1125b","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Laurent Duding","personId":"69dbc07289ecf04f84100212","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-40","id":"VENNES_Vennes - B22_2026-06-10_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Denis Matias","candidatPersonId":"69ddfbfae910b6872d05ca7e","expert1":{"name":"Daniel Berney","personId":"69dbb567d9434724eaa1124c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Gabriel Maret","personId":"69dbb567d9434724eaa11258","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Patrick Chenaux","personId":"69dbc07289ecf04f8410020f","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":"TPI-2026-48","id":"VENNES_Vennes - B22_2026-06-10_4","period":5,"startTime":"12:40","endTime":"13:40","candidat":"Premat Luca André","candidatPersonId":"69e50ad49c07587649d6ac52","expert1":{"name":"Albert Richard","personId":"69e754332ccbf98274ca0810","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Raphaël Favre","personId":"69dbb567d9434724eaa11282","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Helder Manuel Costa Lopes","personId":"69dbc07289ecf04f841001fa","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":"TPI-2026-38","id":"VENNES_Vennes - B22_2026-06-10_5","period":6,"startTime":"13:50","endTime":"14:50","candidat":"Almeida Sampaio Nelson Filipe","candidatPersonId":"69ddfbf9e910b6872d05c9b5","expert1":{"name":"Bernard Oberson","personId":"69dbb567d9434724eaa11240","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Gabriel Maret","personId":"69dbb567d9434724eaa11258","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Cédric Schaffter","personId":"69dbc07289ecf04f8410020c","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":"TPI-2026-20","id":"VENNES_Vennes - B22_2026-06-10_6","period":7,"startTime":"15:00","endTime":"16:00","candidat":"Racine Thibaud","candidatPersonId":"69ddfbf9e910b6872d05c91c","expert1":{"name":"Nicolas Borboën","personId":"69dbb567d9434724eaa11279","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Diego Criscenti","personId":"69dbb567d9434724eaa1124f","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Roberto Ferrari","personId":"69dbc07289ecf04f8410023d","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":"TPI-2026-2","id":"VENNES_Vennes - B22_2026-06-10_7","period":8,"startTime":"16:10","endTime":"17:10","candidat":"Carneiro Yohan","candidatPersonId":"69e4e15e10790eb80e9b4f65","expert1":{"name":"Olivier Mellina","personId":"69dbb567d9434724eaa1127c","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Bertrand Sahli","personId":"69dbc0c389ecf04f8410025f","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Londero Maeva","personId":"69dbc07289ecf04f8410021d","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"mer., 10.06.2026","classLabel":"","classBadgeClass":"","classFilterValue":"noBadge","roomClassName":"","roomStyle":{}}},{"idRoom":13593077,"lastUpdate":1777704729050,"site":"VENNES","date":"2026-06-11T00:00:00.000Z","name":"Vennes - A22","roomClassMode":"nonM","configSite":{"breakline":0.16666666666666666,"tpiTime":1,"firstTpiStart":8,"numSlots":8,"soutenanceColor":"","stakeholderIcons":{"candidate":"candidate-violet","expert1":"helmet-green","expert2":"helmet-blue","projectManager":"helmet-orange"},"minTpiPerRoom":3},"tpiDatas":[{"refTpi":"TPI-2026-44","id":"VENNES_Vennes - A22_2026-06-11_0","period":1,"startTime":"8:00","endTime":"9:00","candidat":"Minger Thé","candidatPersonId":"69e5095f9c07587649d6ac1d","expert1":{"name":"Nicolas Borboën","personId":"69dbb567d9434724eaa11279","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Xavier Carrel","personId":"69dbc07289ecf04f8410022c","offres":{"isValidated":false,"submit":[]}},"originalIndex":0},{"refTpi":"TPI-2026-25","id":"VENNES_Vennes - A22_2026-06-11_1","period":2,"startTime":"9:10","endTime":"10:10","candidat":"Botteau Mathis","candidatPersonId":"69e4e11f10790eb80e9b4f53","expert1":{"name":"Bernard Oberson","personId":"69dbb567d9434724eaa11240","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Pascal Piot","personId":"69dbc07289ecf04f84100237","offres":{"isValidated":false,"submit":[]}},"originalIndex":1},{"refTpi":"TPI-2026-19","id":"VENNES_Vennes - A22_2026-06-11_2","period":3,"startTime":"10:20","endTime":"11:20","candidat":"Napoleone Cyril Constant","candidatPersonId":"69e50ad39c07587649d6ac3d","expert1":{"name":"Bernard Oberson","personId":"69dbb567d9434724eaa11240","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Gael Sonney","personId":"69dbc07289ecf04f84100240","offres":{"isValidated":false,"submit":[]}},"originalIndex":2},{"refTpi":"TPI-2026-47","id":"VENNES_Vennes - A22_2026-06-11_3","period":4,"startTime":"11:30","endTime":"12:30","candidat":"Panzetta Vincent Lionel","candidatPersonId":"69e50ad49c07587649d6ac44","expert1":{"name":"Serge Wenger","personId":"69dbb567d9434724eaa11288","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Nemanja Pantic","personId":"69e609d712f10335dc69cb3c","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Patrick Chenaux","personId":"69dbc07289ecf04f8410020f","offres":{"isValidated":false,"submit":[]}},"originalIndex":3},{"refTpi":"TPI-2026-54","id":"VENNES_Vennes - A22_2026-06-11_4","period":5,"startTime":"12:40","endTime":"13:40","candidat":"Harun Findik","candidatPersonId":"69ddfbfae910b6872d05caea","expert1":{"name":"Bernard Oberson","personId":"69dbb567d9434724eaa11240","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Arnaud Sartoni","personId":"69dbb567d9434724eaa1123d","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Helder Manuel Costa Lopes","personId":"69dbc07289ecf04f841001fa","offres":{"isValidated":false,"submit":[]}},"originalIndex":4},{"refTpi":"TPI-2026-30","id":"VENNES_Vennes - A22_2026-06-11_5","period":6,"startTime":"13:50","endTime":"14:50","candidat":"Schafstall Ethan Aymeric","candidatPersonId":"69e50ad49c07587649d6ac60","expert1":{"name":"Bernard Oberson","personId":"69dbb567d9434724eaa11240","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Sofia Roy","personId":"69dbb567d9434724eaa1128b","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Bertrand Sahli","personId":"69dbc0c389ecf04f8410025f","offres":{"isValidated":false,"submit":[]}},"originalIndex":5},{"refTpi":"TPI-2026-24","id":"VENNES_Vennes - A22_2026-06-11_6","period":7,"startTime":"15:00","endTime":"16:00","candidat":"Belkhiria Sofiene Habib","candidatPersonId":"69ddfbf9e910b6872d05c970","expert1":{"name":"Nicolas Borboën","personId":"69dbb567d9434724eaa11279","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Luc Venries","personId":"69dbb567d9434724eaa11264","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Romain Rosay","personId":"69dbc07289ecf04f8410021a","offres":{"isValidated":false,"submit":[]}},"originalIndex":6},{"refTpi":"TPI-2026-51","id":"VENNES_Vennes - A22_2026-06-11_7","period":8,"startTime":"16:10","endTime":"17:10","candidat":"Skupovska Veronika","candidatPersonId":"69ddfbfae910b6872d05cb02","expert1":{"name":"Alain Pittet","personId":"69dbb567d9434724eaa11237","offres":{"isValidated":false,"submit":[]}},"expert2":{"name":"Mathias Giroud","personId":"69dbb567d9434724eaa11267","offres":{"isValidated":false,"submit":[]}},"boss":{"name":"Laurent Deschamps","personId":"69e60b5412f10335dc69cbf5","offres":{"isValidated":false,"submit":[]}},"originalIndex":7}],"_static":{"dateLabel":"jeu., 11.06.2026","classLabel":"","classBadgeClass":"","classFilterValue":"noBadge","roomClassName":"","roomStyle":{}}}]}</script>
  <?php echo $staticMagicLinkBootstrap; ?>
  <script>
    (function () {
      var payload = JSON.parse(document.getElementById('defense-data').textContent);
      var rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
      var queryParams = new URLSearchParams(window.location.search);
      var magicLinkToken = (queryParams.get('ml') || '').trim();
      var serverMagicLinkValidated = window.__STATIC_MAGIC_LINK_VALIDATED__ === true;
      var serverMagicLinkViewer = window.__STATIC_MAGIC_LINK_VIEWER__ || null;
      var magicLinkViewer = serverMagicLinkViewer;
      var magicLinkPending = Boolean(magicLinkToken && !serverMagicLinkValidated);
      var magicLinkError = '';
      var roomsNode = document.getElementById('rooms');
      var emptyNode = document.getElementById('empty-state');
      var resultCount = document.getElementById('result-count');
      var soutenances = document.getElementById('soutenances');
      var focusBanner = document.getElementById('focus-banner');
      var focusTitle = document.getElementById('focus-title');
      var focusText = document.getElementById('focus-text');
      var personIcalNode = document.getElementById('static-person-ical');
      var personIcalButton = document.getElementById('static-person-ical-download');
      var personIcalLabel = document.getElementById('static-person-ical-label');
      var currentPersonIcalEvents = [];
      var filters = {
        site: '',
        date: '',
        reference: '',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        classType: '',
        nameRoom: ''
      };

      function normalizeText(value) {
        return String(value || '').toLowerCase();
      }

      function html(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function normalizeReference(value) {
        return normalizeText(value).replace(/^tpi-\d{4}-/i, '');
      }

      function matchesReferenceFilter(filterValue, reference) {
        var normalizedFilter = normalizeReference(filterValue);
        var normalizedReference = normalizeReference(reference);
        var rawFilter = normalizeText(filterValue);
        var rawReference = normalizeText(reference);
        return Boolean(normalizedFilter && normalizedReference && (
          normalizedFilter === normalizedReference || rawFilter === rawReference
        ));
      }

      function getRoomSlots(room) {
        var schedule = buildSchedule(room);
        var tpiDatas = Array.isArray(room.tpiDatas) ? room.tpiDatas : [];
        var configuredSlots = parsePositiveInteger(room.configSite && room.configSite.numSlots, 0);
        var maxTpiIndex = tpiDatas.reduce(function (maxIndex, tpiData, index) {
          return Math.max(maxIndex, getLegacyScheduleIndex(tpiData, index));
        }, -1);
        var slotCount = Math.max(configuredSlots, schedule.length, tpiDatas.length, maxTpiIndex + 1, 0);
        var slots = Array.from({ length: slotCount }, function (_, index) {
          return {
            index: index,
            tpiData: null,
            displayedSlot: schedule[index] || { startTime: '', endTime: '' }
          };
        });

        tpiDatas.forEach(function (tpiData, fallbackIndex) {
          var slotIndex = getLegacyScheduleIndex(tpiData, fallbackIndex);
          if (slotIndex < 0 || slotIndex >= slots.length) {
            return;
          }

          slots[slotIndex] = {
            index: slotIndex,
            tpiData: tpiData,
            displayedSlot: getDisplayedSlot(tpiData, schedule, slotIndex)
          };
        });

        return slots;
      }

      function parsePositiveInteger(value, fallback) {
        var parsed = Number.parseInt(String(value), 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
      }

      function parseNonNegativeInteger(value, fallback) {
        var parsed = Number.parseInt(String(value), 10);
        return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
      }

      function decimalTime(value) {
        var numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return '';
        }
        var totalMinutes = Math.round(numericValue * 60);
        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      }

      function buildSchedule(room) {
        var configSite = room.configSite || {};
        var totalSlots = parsePositiveInteger(configSite.numSlots, 0);
        var breakDuration = Number(configSite.breakline || 0);
        var slotDuration = Number(configSite.tpiTime || 0);
        var currentTime = Number(configSite.firstTpiStart || 0);
        if (totalSlots <= 0 || !Number.isFinite(slotDuration) || slotDuration <= 0) {
          return [];
        }
        return Array.from({ length: totalSlots }, function (_, index) {
          var startTime = currentTime;
          var endTime = currentTime + slotDuration;
          currentTime = index < totalSlots - 1 ? endTime + (Number.isFinite(breakDuration) ? breakDuration : 0) : endTime;
          return { startTime: decimalTime(startTime), endTime: decimalTime(endTime) };
        });
      }

      function getLegacyScheduleIndex(tpiData, fallbackIndex) {
        var originalIndex = parseNonNegativeInteger(tpiData && tpiData.originalIndex, null);
        if (originalIndex !== null) return originalIndex;
        var period = parsePositiveInteger(tpiData && tpiData.period, null);
        if (period !== null) return period - 1;
        var idIndex = parseNonNegativeInteger(String((tpiData && tpiData.id) || '').split('_').pop(), null);
        return idIndex === null ? fallbackIndex : idIndex;
      }

      function getDisplayedSlot(tpiData, schedule, fallbackIndex) {
        if (tpiData && tpiData.startTime && tpiData.endTime) {
          return { startTime: tpiData.startTime, endTime: tpiData.endTime };
        }
        return schedule[getLegacyScheduleIndex(tpiData, fallbackIndex)] || { startTime: '', endTime: '' };
      }

      function formatTimeRange(startTime, endTime) {
        return startTime && endTime ? startTime + ' - ' + endTime : 'Horaire indisponible';
      }

      function shouldShowEmptySlots() {
        if (magicLinkViewer || magicLinkPending || magicLinkError) {
          return false;
        }

        var activeKeys = Object.keys(filters).filter(function (key) {
          return filters[key];
        });
        var structural = new Set(['date', 'nameRoom', 'classType']);
        return activeKeys.length === 0 || activeKeys.every(function (key) {
          return structural.has(key);
        });
      }

      function roomMatches(room) {
        if (filters.classType && ((room._static && room._static.classFilterValue) || 'noBadge') !== filters.classType) return false;
        if (filters.nameRoom && room.name !== filters.nameRoom) return false;
        if (filters.site && room.site !== filters.site) return false;
        if (filters.date && ((room._static && room._static.dateLabel) !== filters.date && room.date !== filters.date)) return false;
        return true;
      }

      function doesTpiMatchViewer(tpi, viewer) {
        if (!viewer || (!viewer.personId && !viewer.name)) return true;
        var participantIds = [
          tpi.candidatPersonId,
          tpi.expert1 && tpi.expert1.personId,
          tpi.expert2 && tpi.expert2.personId,
          tpi.boss && tpi.boss.personId
        ].filter(Boolean).map(String);
        if (viewer.personId && participantIds.indexOf(String(viewer.personId)) >= 0) return true;
        var viewerName = normalizeText(viewer.name);
        if (!viewerName) return false;
        return [
          tpi.candidat,
          tpi.expert1 && tpi.expert1.name,
          tpi.expert2 && tpi.expert2.name,
          tpi.boss && tpi.boss.name
        ].some(function (name) {
          return normalizeText(name).includes(viewerName);
        });
      }

      function tpiMatches(tpi) {
        if (!tpi) return false;
        if (magicLinkPending || magicLinkError) return false;
        if (!doesTpiMatchViewer(tpi, magicLinkViewer)) return false;
        if (filters.reference && !matchesReferenceFilter(filters.reference, tpi.refTpi)) return false;
        if (filters.candidate && !normalizeText(tpi.candidat).includes(normalizeText(filters.candidate))) return false;
        if (filters.experts && !(
          normalizeText(tpi.expert1 && tpi.expert1.name).includes(normalizeText(filters.experts)) ||
          normalizeText(tpi.expert2 && tpi.expert2.name).includes(normalizeText(filters.experts))
        )) return false;
        if (filters.projectManager && !normalizeText(tpi.boss && tpi.boss.name).includes(normalizeText(filters.projectManager))) return false;
        if (filters.projectManagerButton && !(
          normalizeText(tpi.expert1 && tpi.expert1.name).includes(normalizeText(filters.projectManagerButton)) ||
          normalizeText(tpi.expert2 && tpi.expert2.name).includes(normalizeText(filters.projectManagerButton)) ||
          normalizeText(tpi.boss && tpi.boss.name).includes(normalizeText(filters.projectManagerButton))
        )) return false;
        return true;
      }

      function getFilteredRooms() {
        return rooms.flatMap(function (room) {
          if (!roomMatches(room)) return [];
          var tpis = (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).filter(tpiMatches);
          if (tpis.length === 0) return [];
          return Object.assign({}, room, { tpiDatas: tpis });
        });
      }

      function getMagicLinkViewerRooms() {
        if (!magicLinkViewer || (!magicLinkViewer.personId && !magicLinkViewer.name)) {
          return [];
        }

        return rooms.flatMap(function (room) {
          var tpis = (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).filter(function (tpi) {
            return tpi && tpi.refTpi && doesTpiMatchViewer(tpi, magicLinkViewer);
          });

          return tpis.length > 0 ? [Object.assign({}, room, { tpiDatas: tpis })] : [];
        });
      }

      function escapeIcsText(value) {
        var slash = String.fromCharCode(92);
        return String(value || '')
          .split(slash).join(slash + slash)
          .split(String.fromCharCode(13)).join(slash + 'n')
          .split(String.fromCharCode(10)).join(slash + 'n')
          .split(',').join(slash + ',')
          .split(';').join(slash + ';');
      }

      function buildICalDate(dateValue) {
        var parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          return '';
        }

        return parsedDate.toISOString().slice(0, 10).replace(/-/g, '');
      }

      function buildICalDateTime(dateValue, timeValue) {
        var datePart = buildICalDate(dateValue);
        var parts = String(timeValue || '').split(':');
        if (!datePart || parts.length < 2 || !parts[0] || !parts[1]) {
          return '';
        }

        return datePart + 'T' + parts[0].padStart(2, '0') + parts[1].padStart(2, '0') + '00';
      }

      function buildIcalEvent(entry, dtStamp, index) {
        var room = entry.salle || {};
        var tpi = entry.tpi || {};
        var start = buildICalDateTime(room.date, entry.startTime);
        var end = buildICalDateTime(room.date, entry.endTime);

        if (!start || !end) {
          return null;
        }

        var eventUid = [payload.year, tpi.refTpi || 'tpi', tpi.id || room.idRoom || room.name || 'room', index].join('-');
        var eventSummary = 'Défense TPI ' + (tpi.refTpi || 'sans-référence') + ' - ' + (tpi.candidat || '');
        var eventDescription = [
          'Défense de TPI ' + (tpi.candidat || ''),
          'Expert 1: ' + ((tpi.expert1 && tpi.expert1.name) || ''),
          'Expert 2: ' + ((tpi.expert2 && tpi.expert2.name) || ''),
          'Encadrant: ' + ((tpi.boss && tpi.boss.name) || '')
        ].join(String.fromCharCode(10));
        var location = [room.site, room.name].filter(Boolean).join(' - ');

        return [
          'BEGIN:VEVENT',
          'DTSTAMP:' + dtStamp,
          'UID:' + escapeIcsText(eventUid),
          'DTSTART;TZID=Europe/Berlin:' + start,
          'DTEND;TZID=Europe/Berlin:' + end,
          'SUMMARY:' + escapeIcsText(eventSummary),
          'DESCRIPTION:' + escapeIcsText(eventDescription),
          'LOCATION:' + escapeIcsText(location),
          'TRANSP:TRANSPARENT',
          'CLASS:PUBLIC',
          'END:VEVENT'
        ].join(String.fromCharCode(10));
      }

      function buildIcalContent(events) {
        var dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/g, 'Z');
        var lines = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//tpiOrganizer2023//iCal',
          'BEGIN:VTIMEZONE',
          'TZID:Europe/Berlin',
          'BEGIN:DAYLIGHT',
          'TZOFFSETFROM:+0100',
          'TZOFFSETTO:+0200',
          'DTSTART:19700329T020000',
          'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
          'END:DAYLIGHT',
          'BEGIN:STANDARD',
          'TZOFFSETFROM:+0200',
          'TZOFFSETTO:+0100',
          'DTSTART:19701025T030000',
          'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
          'END:STANDARD',
          'END:VTIMEZONE'
        ];

        events.forEach(function (event, index) {
          var eventBlock = buildIcalEvent(event, dtStamp, index);
          if (eventBlock) {
            lines.push(eventBlock);
          }
        });

        lines.push('END:VCALENDAR');
        return lines.join(String.fromCharCode(10));
      }

      function collectIcalEvents(sourceRooms) {
        return sourceRooms.flatMap(function (room) {
          return getRoomSlots(room)
            .filter(function (slot) {
              return Boolean(slot.tpiData && slot.tpiData.refTpi);
            })
            .map(function (slot) {
              var displayedSlot = slot.displayedSlot || getDisplayedSlot(slot.tpiData, buildSchedule(room), slot.index);
              return {
                salle: room,
                tpi: slot.tpiData,
                startTime: displayedSlot.startTime,
                endTime: displayedSlot.endTime
              };
            })
            .filter(function (entry) {
              return Boolean(entry.startTime && entry.endTime);
            });
        });
      }

      function sanitizeFileName(value) {
        return String(value || 'soutenances')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w.-]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      function downloadPersonIcal() {
        if (currentPersonIcalEvents.length === 0) {
          return;
        }

        var icalContent = buildIcalContent(currentPersonIcalEvents);
        var blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        var baseName = magicLinkViewer && magicLinkViewer.name ? magicLinkViewer.name : 'soutenances';

        anchor.href = url;
        anchor.download = sanitizeFileName(baseName) + '_soutenances.ics';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }

      function syncPersonIcal() {
        var personRooms = getMagicLinkViewerRooms();
        currentPersonIcalEvents = collectIcalEvents(personRooms);
        var shouldShow = Boolean(magicLinkViewer && currentPersonIcalEvents.length > 0);

        personIcalNode.classList.toggle('static-hidden', !shouldShow);
        personIcalButton.disabled = !shouldShow;

        if (shouldShow) {
          personIcalButton.setAttribute(
            'aria-label',
            'Télécharger votre iCal Outlook pour ' + (magicLinkViewer.name || 'vos défenses')
          );
          personIcalLabel.textContent = 'Télécharger votre iCal (' + currentPersonIcalEvents.length + ')';
        }
      }

      function isAnyFilterApplied() {
        return Boolean(magicLinkViewer || magicLinkPending || magicLinkError) || Object.keys(filters).some(function (key) {
          return Boolean(filters[key]);
        });
      }

      function styleText(styleObject, roomIndex) {
        var style = Object.assign({ '--room-reveal-index': roomIndex }, styleObject || {});
        return Object.keys(style).map(function (key) {
          return key + ':' + style[key];
        }).join(';');
      }

      function normalizeStakeholderIconKey(stakeholderIcons, type) {
        var icons = stakeholderIcons && typeof stakeholderIcons === 'object' ? stakeholderIcons : {};
        var fallback = type === 'candidate' ? 'candidate' : 'participant';
        return String(icons[type] || (type === 'projectManager' ? icons.boss : '') || fallback).trim() || fallback;
      }

      function candidateIconSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="stakeholder-icon-svg">' +
          '<path d="M7 10.6v4.15c1.2 1.3 2.88 1.95 5 1.95s3.8-.65 5-1.95V10.6l-5 2.7-5-2.7Z" fill="var(--role-icon-soft, #bfdbfe)" stroke="none"></path>' +
          '<path d="M12 3.5 2.8 8.2 12 13l9.2-4.8L12 3.5Z" fill="var(--role-icon-primary, #60a5fa)" stroke="var(--role-icon-stroke, #1d4ed8)" stroke-width="1.35" stroke-linejoin="round"></path>' +
          '<path d="M5.2 9.45v4.75m13.6-5.95v5.95M7 10.6l5 2.7 5-2.7" fill="none" stroke="var(--role-icon-stroke, #1d4ed8)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
          '<circle cx="18.8" cy="14.2" r="1.15" fill="var(--role-icon-stroke, #1d4ed8)" stroke="none"></circle>' +
          '</svg>';
      }

      function expertIconSvg(badge) {
        var badgeText = badge
          ? '<text x="12" y="11.25" text-anchor="middle" dominant-baseline="middle" fill="var(--role-icon-stroke, #854d0e)" stroke="none" font-size="7.2" font-weight="800" font-family="Arial, Helvetica, sans-serif">' + html(badge) + '</text>'
          : '';
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="stakeholder-icon-svg">' +
          '<path d="M5.1 13.55C5.38 9.75 7.75 6.7 10.95 6v4.45h2.1V6c3.2.7 5.57 3.75 5.85 7.55H5.1Z" fill="var(--role-icon-soft, #fef08a)" stroke="none"></path>' +
          '<path d="M4.2 13.3h15.6c.75 0 1.35.6 1.35 1.35S20.55 16 19.8 16H4.2c-.75 0-1.35-.6-1.35-1.35s.6-1.35 1.35-1.35Z" fill="var(--role-icon-primary, #facc15)" stroke="var(--role-icon-stroke, #854d0e)" stroke-width="1.25" stroke-linejoin="round"></path>' +
          '<path d="M5.15 13.35C5.5 9.2 8.35 6 12 6s6.5 3.2 6.85 7.35M10.95 6v4.45m2.1-4.45v4.45M4.2 16h15.6" fill="none" stroke="var(--role-icon-stroke, #854d0e)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
          badgeText +
          '</svg>';
      }

      function projectLeadIconSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="stakeholder-icon-svg">' +
          '<path d="M5.1 13.55C5.38 9.75 7.75 6.7 10.95 6v4.45h2.1V6c3.2.7 5.57 3.75 5.85 7.55H5.1Z" fill="var(--role-icon-soft, #fecaca)" stroke="none"></path>' +
          '<path d="M4.2 13.3h15.6c.75 0 1.35.6 1.35 1.35S20.55 16 19.8 16H4.2c-.75 0-1.35-.6-1.35-1.35s.6-1.35 1.35-1.35Z" fill="var(--role-icon-primary, #ef4444)" stroke="var(--role-icon-stroke, #7f1d1d)" stroke-width="1.25" stroke-linejoin="round"></path>' +
          '<path d="M5.15 13.35C5.5 9.2 8.35 6 12 6s6.5 3.2 6.85 7.35M10.95 6v4.45m2.1-4.45v4.45M4.2 16h15.6" fill="none" stroke="var(--role-icon-stroke, #7f1d1d)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
          '</svg>';
      }

      function roleIcon(type, label, stakeholderIcons) {
        var resolvedIconKey = normalizeStakeholderIconKey(stakeholderIcons, type);
        var isCandidateIcon = type === 'candidate' || resolvedIconKey.indexOf('candidate-') === 0;
        var isProjectLead = type === 'projectManager';
        var badge = resolvedIconKey === 'participant' || resolvedIconKey.indexOf('helmet-') === 0
          ? (type === 'expert1' ? '1' : type === 'expert2' ? '2' : '')
          : '';
        var icon = isCandidateIcon
          ? candidateIconSvg()
          : isProjectLead
            ? projectLeadIconSvg()
            : expertIconSvg(badge);
        return '<span class="stakeholder-icon stakeholder-icon--' + html(type) + ' stakeholder-icon--visual-' + html(resolvedIconKey) + '" role="img" aria-label="' + html(label) + '" title="' + html(label) + '">' +
          icon +
          '</span>';
      }

      function renderTpiSlot(room, roomIndex, slot, visibleIndex, anyFilterApplied) {
        var tpi = slot.tpiData || {};
        var hasPublishedTpi = Boolean(tpi.refTpi);
        var displayedSlot = slot.displayedSlot || { startTime: '', endTime: '' };
        var stakeholderIcons = (room.configSite && room.configSite.stakeholderIcons) || {};
        var hasRange = Boolean(displayedSlot.startTime && displayedSlot.endTime);
        var time = formatTimeRange(displayedSlot.startTime, displayedSlot.endTime);
        var selectedClass = filters.reference && matchesReferenceFilter(filters.reference, tpi.refTpi) ? ' is-selected' : '';
        var filterlessClass = !anyFilterApplied ? ' is-filterless' : '';
        var timeHtml = hasRange
          ? '<span>' + html(displayedSlot.startTime) + '</span><span aria-hidden="true">-</span><span>' + html(displayedSlot.endTime) + '</span>'
          : html(time);

        if (!hasPublishedTpi) {
          return '<div class="tpi-data tpi-slot is-slot-empty' + filterlessClass + '" style="--slot-reveal-index:' + visibleIndex + '" title="' + html(room.site + '\n' + ((room._static && room._static.dateLabel) || '') + '\n' + time) + '" aria-label="Créneau vide ' + html(time) + '">' +
            '<div class="slot-time-row"><div class="slot-time slot-time--empty' + (!anyFilterApplied ? ' slot-time--header' : '') + (hasRange ? ' slot-time--range' : '') + '">' + timeHtml + '</div></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '</div>';
        }

        return '<div class="tpi-data tpi-slot' + filterlessClass + selectedClass + '" id="' + html(tpi.id) + '" style="--slot-reveal-index:' + visibleIndex + '" title="' + html(room.site + '\n' + ((room._static && room._static.dateLabel) || '') + '\n' + time) + '">' +
          '<div class="slot-time-row"><div class="slot-time' + (!anyFilterApplied ? ' slot-time--header' : '') + (hasRange ? ' slot-time--range' : '') + '">' + timeHtml + '</div></div>' +
          '<div class="tpi-row-block tpi-row-block--candidate" style="grid-template-columns:auto minmax(0, 1fr) auto">' +
          roleIcon('candidate', 'Candidat', stakeholderIcons) + '<span class="slot-value"><span class="nameTpi">' + html(tpi.candidat) + '</span></span><span class="stakeholder-icon-spacer" aria-hidden="true"></span></div>' +
          '<div class="tpi-row-block" style="grid-template-columns:auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)">' +
          roleIcon('expert1', 'Expert 1', stakeholderIcons) + '<span class="slot-value"><span class="nameTpi">' + html(tpi.expert1 && tpi.expert1.name) + '</span></span><span></span></div>' +
          '<div class="tpi-row-block" style="grid-template-columns:auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)">' +
          roleIcon('expert2', 'Expert 2', stakeholderIcons) + '<span class="slot-value"><span class="nameTpi">' + html(tpi.expert2 && tpi.expert2.name) + '</span></span><span></span></div>' +
          '<div class="tpi-row-block" style="grid-template-columns:auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)">' +
          roleIcon('projectManager', 'Chef de projet', stakeholderIcons) + '<span class="slot-value"><span class="nameTpi">' + html(tpi.boss && tpi.boss.name) + '</span></span><span></span></div>' +
          '</div>';
      }

      function renderRoom(room, roomIndex, anyFilterApplied, showEmpty) {
        var staticData = room._static || {};
        var roomClass = ['salle', room.site, staticData.roomClassName].filter(Boolean).join(' ');
        var classBadge = staticData.classLabel
          ? '<span class="soutenance-room-class-badge ' + html(staticData.classBadgeClass || '') + '" title="Salle ' + html(staticData.classLabel) + '" aria-label="Salle ' + html(staticData.classLabel) + '">' + html(staticData.classLabel) + '</span>'
          : '';
        var slots = getRoomSlots(room);
        var visibleSlots = showEmpty ? slots : slots.filter(function (slot) {
          return Boolean(slot.tpiData && slot.tpiData.refTpi);
        });

        return '<article class="' + html(roomClass) + '" role="listitem" style="' + html(styleText(staticData.roomStyle, roomIndex)) + '">' +
          '<header class="room-header' + (staticData.classLabel ? ' has-room-badge' : '') + '">' +
          '<div class="room-header-badges"><span class="site">' + html(room.site) + '</span>' + classBadge + '</div>' +
          '<div class="room-header-date">' + html(staticData.dateLabel || room.date) + '</div>' +
          '<div class="soutenance-room-title-row"><div class="room-header-name">' + html(room.name) + '</div></div>' +
          '</header>' +
          visibleSlots.map(function (slot, visibleIndex) {
            return renderTpiSlot(room, roomIndex, slot, visibleIndex, anyFilterApplied);
          }).join('') +
          '</article>';
      }

      function readUrlFilters() {
        var dateParam = queryParams.get('date') || '';
        var matchedRoom = rooms.find(function (room) {
          return room.date === dateParam || (room._static && room._static.dateLabel === dateParam);
        });
        filters.date = matchedRoom ? ((matchedRoom._static && matchedRoom._static.dateLabel) || matchedRoom.date) : dateParam;
        filters.site = queryParams.get('site') || '';
        filters.nameRoom = queryParams.get('nameRoom') || queryParams.get('room') || '';
        filters.classType = queryParams.get('classType') || '';
        filters.experts = queryParams.get('experts') || queryParams.get('expert') || '';
        filters.projectManager = queryParams.get('projectManager') || queryParams.get('cdp') || '';
        filters.candidate = queryParams.get('candidate') || queryParams.get('candidat') || '';
        filters.reference = queryParams.get('focus') || queryParams.get('reference') || queryParams.get('ref') || '';
        var person = queryParams.get('person') || queryParams.get('q') || '';
        if (person && !filters.experts && !filters.projectManager && !filters.candidate) {
          filters.experts = person;
          filters.projectManager = person;
          filters.candidate = person;
        }
      }

      function renderFocusBanner(filteredRooms) {
        if (magicLinkPending) {
          focusBanner.className = 'soutenance-focus-banner is-ready';
          focusTitle.textContent = 'Lien magique en cours de vérification';
          focusText.textContent = 'La vue personnelle se charge.';
          return;
        }

        if (magicLinkError) {
          focusBanner.className = 'soutenance-focus-banner is-missing';
          focusTitle.textContent = 'Lien magique invalide';
          focusText.textContent = magicLinkError;
          return;
        }

        if (magicLinkViewer && (magicLinkViewer.name || magicLinkViewer.personId)) {
          focusBanner.className = 'soutenance-focus-banner is-ready';
          focusTitle.textContent = 'Vue personnelle';
          focusText.textContent = magicLinkViewer.name
            ? 'Défenses liées à ' + magicLinkViewer.name + '.'
            : 'Défenses liées à votre lien magique.';
          return;
        }

        if (!filters.reference) {
          focusBanner.classList.add('static-hidden');
          return;
        }

        var hasResults = filteredRooms.length > 0;
        focusBanner.className = 'soutenance-focus-banner ' + (hasResults ? 'is-ready' : 'is-missing');
        focusTitle.textContent = 'Défense ciblée: ' + filters.reference;
        focusText.textContent = hasResults
          ? 'Affichage de la fiche ciblée.'
          : 'Aucune défense publiée ne correspond à ' + filters.reference + ' pour ' + payload.year + '.';
      }

      function render() {
        var anyFilterApplied = isAnyFilterApplied();
        var showEmpty = shouldShowEmptySlots();
        var filteredRooms = getFilteredRooms();
        roomsNode.style.setProperty('--soutenance-grid-columns', String(Math.max(1, Math.min(5, getResponsiveColumns()))));
        roomsNode.innerHTML = filteredRooms.map(function (room, index) {
          return renderRoom(room, index, anyFilterApplied, showEmpty);
        }).join('');
        emptyNode.classList.toggle('static-hidden', filteredRooms.length > 0 || magicLinkPending);
        soutenances.className = 'soutenances' + (anyFilterApplied ? ' filterActive' : '');
        var count = filteredRooms.reduce(function (total, room) {
          return total + (room.tpiDatas || []).filter(function (tpi) { return Boolean(tpi.refTpi); }).length;
        }, 0);
        resultCount.textContent = magicLinkPending ? 'Vérification du lien...' : count + ' défense(s)';
        renderFocusBanner(filteredRooms);
        syncPersonIcal();
      }

      function getResponsiveColumns() {
        var width = window.innerWidth || 1280;
        if (width <= 680) return 1;
        if (width <= 980) return 2;
        if (width <= 1280) return 3;
        if (width <= 1660) return 4;
        return 5;
      }

      async function resolveMagicLink() {
        if (serverMagicLinkValidated) {
          magicLinkPending = false;
          render();
          return;
        }

        if (!magicLinkToken) {
          return;
        }

        try {
          var response = await fetch('/api/magic-link/resolve?token=' + encodeURIComponent(magicLinkToken), {
            headers: {
              Accept: 'application/json'
            },
            credentials: 'same-origin'
          });
          var data = await response.json().catch(function () { return {}; });

          if (!response.ok) {
            throw new Error(data.error || 'Lien magique invalide ou expiré.');
          }

          if (data.type !== 'soutenance') {
            throw new Error('Ce lien magique ne donne pas accès aux défenses.');
          }

          if (data.year && String(data.year) !== String(payload.year)) {
            throw new Error('Ce lien cible l annee ' + data.year + ' et non ' + payload.year + '.');
          }

          magicLinkViewer = data.viewer || null;
        } catch (error) {
          magicLinkError = error && error.message ? error.message : 'Lien magique invalide ou expiré.';
        } finally {
          magicLinkPending = false;
          render();
        }
      }

      readUrlFilters();
      function triggerStaticPrint() {
        var printButton = document.getElementById('static-print');
        var originalLabel = printButton ? printButton.textContent : '';
        var restoreButton = function () {
          if (!printButton) return;
          printButton.disabled = false;
          printButton.textContent = originalLabel || 'PDF';
        };

        if (printButton) {
          printButton.disabled = true;
          printButton.textContent = 'PDF...';
        }

        window.addEventListener('afterprint', restoreButton, { once: true });
        window.focus();

        try {
          window.print();
        } finally {
          window.setTimeout(restoreButton, 1400);
        }
      }

      document.getElementById('static-print').addEventListener('click', triggerStaticPrint);
      personIcalButton.addEventListener('click', downloadPersonIcal);
      window.addEventListener('resize', render);
      render();
      resolveMagicLink();
    })();
  </script>
</body>
</html>