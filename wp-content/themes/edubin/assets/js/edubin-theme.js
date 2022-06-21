/*==================================
Edubin theme activation scripts  
====================================*/
(function($) {
    "use strict";
    //===== Prealoder
    $(window).on('load', function(event) {
        $('.preloader').delay(500).fadeOut(500);
        // Preloader two 
        $('#preloader_two').fadeOut()
        // Icon Preloader 
        $(".edubin_image_preloader").fadeOut("slow");;
    });
    // === Sticky header
    $(function() {
        var header = $(".is-header-sticky"),
            yOffset = 0,
            triggerPoint = 220;
        $(window).on('scroll', function() {
            yOffset = $(window).scrollTop();
            if (yOffset >= triggerPoint) {
                header.addClass("sticky-active animated slideInDown");
            } else {
                header.removeClass("sticky-active animated slideInDown");
            }
        });
    });

    //===== Search
    $('#search').on('click', function() {
        $(".edubin-search-box").fadeIn(600);
    });
    $('.edubin-closebtn').on('click', function() {
        $(".edubin-search-box").fadeOut(600);
    });

    //===== Add class for tribe event archive page
    jQuery(function() {
        jQuery('.post-type-archive-tribe_events .page-title').each(function() {
            var text = this.innerHTML;
            var firstSpaceIndex = text.indexOf(" ");
            if (firstSpaceIndex > 0) {
                var substrBefore = text.substring(0, firstSpaceIndex);
                var substrAfter = text.substring(firstSpaceIndex, text.length)
                var newText = '<span class="firstWord">' + substrBefore + '</span>' + substrAfter;
                this.innerHTML = newText;
            } else {
                this.innerHTML = '<span class="firstWord edubinHidden">' + text + '</span>';
            }
        });
    });

    //===== Add cart button text remove
    jQuery(function() {
        jQuery('.edubin-cart-button-list > a.button').each(function() {
            var text = this.innerHTML;
            var firstSpaceIndex = text.indexOf("");
            if (firstSpaceIndex > 0) {
                var substrBefore = text.substring(0, firstSpaceIndex);
                var substrAfter = text.substring(firstSpaceIndex, text.length)
                var newText = '<span class="edubin-hide-addtocart-text">' + substrBefore + '</span>' + substrAfter;
                this.innerHTML = newText;
            } else {
                this.innerHTML = '<span class="edubin-hide-addtocart-text hidden">' + text + '</span>';
            }
        });
    });
    
    //===== Tutor LMS course filter 
    $(document).on('change', '.tutor-course-filter-form', function(e) {
        e.preventDefault();
        $(this).closest('form').submit();
    });
    $('.tutor-pagination ul li a.prev, .tutor-pagination ul li a.next').closest('li').addClass('pagination-parent');
    // category menu
    $('.header-cat-menu ul.children').closest('li.cat-item').addClass('category-has-childern');
    $(".tutor-archive-single-cat .category-toggle").on('click', function() {
        $(this).next('.tutor-archive-childern').slideToggle();
        if ($(this).hasClass('fa-plus')) {
            $(this).removeClass('fa-plus').addClass('fa-minus');
        } else {
            $(this).removeClass('fa-minus').addClass('fa-plus');
        }
    });
    $('.tutor-archive-childern input').each(function() {
        if ($(this).is(':checked')) {
            var aChild = $(this).closest('.tutor-archive-childern');
            aChild.show();
            aChild.siblings('.fa').removeClass('fa-plus').addClass('fa-minus');
        }
    });
    $('.tutor-sidebar-filter input').on('change', function() {
        $('.tutor-sidebar-filter').submit();
    });


})(jQuery);